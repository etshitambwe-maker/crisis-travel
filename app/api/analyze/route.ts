import { NextResponse } from 'next/server';
import { z } from 'zod';
import { calculateCrisisScore } from '@/lib/services/scoring/crisisScore.service';
import { detectOpportunities } from '@/lib/claude/claude.service';
import { TARGET_COUNTRIES } from '@/lib/utils/countries';
import { selectCandidates, CANDIDATE_CAP, type SelectMode } from '@/lib/utils/selectCandidates';
import { checkRateLimit, getClientIdentifier } from '@/lib/middleware/rateLimit';
import { checkAndIncrementQuota } from '@/lib/auth/analysisQuota';
import { getUser } from '@/lib/auth/supabase-server';
import type { AnalyzeResponse, OpportunityWindow } from '@/types/crisis.types';

// Plafond technique : l'analyse cold-cache de tous les pays peut dépasser les
// 10s par défaut de Vercel. 60s couvre tous les plans (Hobby max 60s) et évite
// que la fonction soit tuée avant la fin — cause racine des fausses erreurs réseau.
export const maxDuration = 60;

const Schema = z.object({
  profile: z.object({
    departureCountry: z.string().min(2),
    budget: z.number().min(100).max(50000),
    duration: z.number().min(1).max(365),
    period: z.string().default('flexible'),
    travelType: z.enum(['solo', 'couple', 'family', 'nomad']),
    mode: z.enum(['standard', 'bunker', 'budget_crisis']).default('standard'),
    excludedContinents: z.array(z.string()).optional(),
    continent: z.string().optional(),        // filtre par continent
    priority: z.string().optional(),          // securite | budget | decouverte | tout
    sortBy: z.enum(['score', 'security', 'budget', 'alpha']).optional(),
    departureDate: z.string().optional(),
    returnDate: z.string().optional(),
  }),
});

/**
 * Réponse 503 structurée pour une panne d'un service AMONT (Redis, Supabase),
 * survenue AVANT l'analyse. Distincte du 500 (erreur d'analyse/scoring).
 * Le champ `stage` identifie l'étage fautif pour le diagnostic ; le message
 * utilisateur reste neutre et ne mentionne jamais Redis ni Supabase.
 */
function upstreamUnavailable(stage: 'rate-limit' | 'auth' | 'quota'): NextResponse {
  return NextResponse.json(
    {
      error: 'Le service d\'analyse est temporairement indisponible. Réessayez dans quelques instants.',
      stage,
    },
    { status: 503 }
  );
}

export async function POST(request: Request): Promise<NextResponse> {
  const t0 = Date.now();

  // ── Étapes pré-analyse (rate-limit, auth, quota) ──────────────────────────
  // Toute exception ici (Redis/Supabase injoignable) doit renvoyer un 503 JSON
  // propre — sinon Vercel renvoie une page d'erreur HTML brute que le client
  // ne sait pas classer. Fail-closed sur le quota : on ne lance JAMAIS l'analyse
  // si le contrôle quota échoue, pour protéger les APIs payantes (Claude/Perplexity).
  let quota: Awaited<ReturnType<typeof checkAndIncrementQuota>>;
  try {
    // Rate limiting — protège les APIs payantes (Claude, Perplexity)
    const ip = getClientIdentifier(request);
    let rl;
    try {
      rl = await checkRateLimit(ip, 'anonymous');
    } catch (e) {
      console.error('[API/analyze] rate-limit', e);
      return upstreamUnavailable('rate-limit');
    }
    if (!rl.success) {
      return NextResponse.json(
        {
          error: 'Limite de requêtes atteinte. Réessayez dans 1 heure.',
          retryAfter: Math.ceil((rl.reset - Date.now()) / 1000),
          remaining: 0,
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil((rl.reset - Date.now()) / 1000)),
            'X-RateLimit-Limit': String(rl.limit),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(rl.reset),
          },
        }
      );
    }

    // Quota analyses gratuites (3/mois pour les comptes free)
    let user;
    try {
      user = await getUser();
    } catch (e) {
      console.error('[API/analyze] auth', e);
      return upstreamUnavailable('auth');
    }
    try {
      quota = await checkAndIncrementQuota(user?.id ?? null);
    } catch (e) {
      console.error('[API/analyze] quota', e);
      return upstreamUnavailable('quota');
    }
  } catch (e) {
    // Filet de sécurité : toute exception inattendue dans le bloc pré-analyse.
    console.error('[API/analyze] pre-analyse', e);
    return upstreamUnavailable('auth');
  }

  if (!quota.allowed) {
    return NextResponse.json(
      {
        error: 'Quota mensuel atteint. Passez à Premium pour des analyses illimitées.',
        quota: { used: quota.used, limit: quota.limit, remaining: 0 },
        upgradeUrl: '/pricing',
      },
      {
        status: 402,
        headers: { 'X-Quota-Remaining': '0', 'X-Quota-Limit': String(quota.limit) },
      }
    );
  }

  try {
    const body = await request.json();
    const { profile } = Schema.parse(body);

    let countries = [...TARGET_COUNTRIES];
    // Filtre par continent unique (mode région)
    if (profile.continent) {
      countries = countries.filter((c) => c.continent === profile.continent);
    } else if (profile.excludedContinents?.length) {
      countries = countries.filter((c) => !profile.excludedContinents!.includes(c.continent));
    }

    // Pré-sélection des candidats AVANT le scoring (GOAL-031) — évite le timeout 60s.
    // Mode continent : on garde tous les pays du continent (cap null). Sinon, on ne
    // score que les CANDIDATE_CAP meilleurs d'après STATIC_HINTS (proxy statique, sans
    // appel réseau), triés selon l'axe du mode. Le scoring réel reste inchangé.
    const selectMode: SelectMode = profile.mode === 'bunker' ? 'bunker'
      : profile.mode === 'budget_crisis' ? 'budget_crisis' : 'standard';
    countries = selectCandidates(countries, selectMode, profile.continent ? null : CANDIDATE_CAP);

    // Batch de 6 pour limiter la concurrence sur les APIs externes
    const BATCH = 6;
    // Budget de temps global (GOAL-032) : on n'engage PAS un nouveau batch si on a
    // dépassé ce seuil. Garantit qu'on garde ~15s pour trier/sérialiser/répondre sous
    // le plafond Vercel 60s, et qu'on renvoie un résultat PARTIEL plutôt qu'un 504.
    const TIME_BUDGET_MS = 45000;
    const tScoringStart = Date.now();
    const results = [];
    let partial = false;
    for (let i = 0; i < countries.length; i += BATCH) {
      if (Date.now() - t0 > TIME_BUDGET_MS) {
        partial = true;
        console.warn(`[API/analyze] budget timeout — ${results.length}/${countries.length} pays scorés avant arrêt`);
        break;
      }
      const batch = countries.slice(i, i + BATCH);
      const settled = await Promise.allSettled(
        batch.map((c) => calculateCrisisScore(c, profile))
      );
      for (const r of settled) {
        if (r.status === 'fulfilled') results.push(r.value);
      }
    }
    const msScoring = Date.now() - tScoringStart;

    // Tri selon sortBy ou mode
    let sorted = [...results];
    const sortBy = profile.sortBy;
    if (sortBy === 'security')     sorted = sorted.sort((a, b) => b.security.value - a.security.value);
    else if (sortBy === 'budget')  sorted = sorted.sort((a, b) => b.budget.value - a.budget.value);
    else                           sorted = sorted.sort((a, b) => b.total - a.total);

    // Filtres mode spéciaux
    if (profile.mode === 'bunker')        sorted = sorted.filter((s) => s.security.value >= 80);
    if (profile.mode === 'budget_crisis') sorted = sorted.filter((s) => s.budget.value >= 70 && s.security.value >= 60);

    const topDestinations = sorted.slice(0, 5);

    // detectOpportunities (Claude) ne s'exécute que s'il reste du budget — sinon on
    // omet les opportunités plutôt que de risquer le 504 sur la dernière ligne droite.
    const tOppStart = Date.now();
    const rawOpportunities = Date.now() - t0 > TIME_BUDGET_MS
      ? []
      : await detectOpportunities(sorted, profile.budget);
    const msOpportunities = Date.now() - tOppStart;
    const opportunities = rawOpportunities.map((op) => ({
      ...op,
      country: sorted.find((s) => s.countryCode === op.countryCode)?.country ?? op.countryCode,
      score: sorted.find((s) => s.countryCode === op.countryCode)?.total ?? 0,
      type: op.type as OpportunityWindow['type'],
    }));

    const msTotal = Date.now() - t0;
    // Logs timing structurés temporaires (GOAL-032 / option F) — à retirer une fois
    // le goulot confirmé en prod. Permet de voir le vrai coût de chaque étape.
    console.log('[API/analyze] timing', JSON.stringify({
      mode: profile.mode, selected: countries.length, scored: results.length,
      msScoring, msOpportunities, msTotal, partial,
    }));

    const response: AnalyzeResponse = {
      results: sorted,
      topDestinations,
      opportunities,
      meta: { analyzedCountries: results.length, duration: msTotal, cacheHitRate: 0, partial },
    };
    return NextResponse.json(response, {
      headers: {
        'X-Quota-Remaining': quota.isPremium ? '999' : String(quota.remaining),
        'X-Quota-Limit': quota.isPremium ? '999' : '3',
        'X-Quota-Used': String(quota.used),
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Données invalides', details: error.issues }, { status: 400 });
    }
    console.error('[API/analyze] analyse', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
