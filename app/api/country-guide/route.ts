import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getUserWithSubscription } from '@/lib/auth/supabase-server';
import { getPerplexityCountryFacts } from '@/lib/services/geopolitical/perplexity.service';
import { generatePremiumCountryGuide } from '@/lib/claude/claude.service';
import { calculateCrisisScore } from '@/lib/services/scoring/crisisScore.service';
import { findCountry } from '@/lib/utils/countries';
import type { CountryGuideApiResponse } from '@/types/crisis.types';

// PREMIUM-GUIDE-001C — génération on-demand (jamais SSR). Perplexity + Claude en chaîne
// peuvent dépasser le défaut Vercel ; 60s = plafond du plan (pas une garantie).
export const maxDuration = 60;

const schema = z.object({
  countryCode: z.string().min(2).max(3).toUpperCase(),
  countryName: z.string().min(1).max(100),
  travelType: z.enum(['solo', 'couple', 'family', 'nomad']).optional(),
  budget: z.number().positive().max(1_000_000).optional(),
  duration: z.number().int().min(1).max(365).optional(),
  // TRAVEL-DATES-001 — dates de voyage optionnelles (YYYY-MM-DD)
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format attendu : YYYY-MM-DD').optional(),
  to:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format attendu : YYYY-MM-DD').optional(),
}).refine(
  (d) => { if (!d.from || !d.to) return true; return new Date(d.to) > new Date(d.from); },
  { message: 'La date de retour doit être après la date de départ', path: ['to'] },
);

export async function POST(request: Request): Promise<NextResponse> {
  const t0 = Date.now();

  const { user, isPremium } = await getUserWithSubscription();
  if (!user) {
    return NextResponse.json({ error: 'Authentification requise' }, { status: 401 });
  }
  if (!isPremium) {
    return NextResponse.json(
      { error: 'Guide pays disponible avec le plan Premium', upgradeUrl: '/pricing' },
      { status: 402 },
    );
  }

  const contentLength = Number(request.headers.get('content-length') ?? 0);
  if (contentLength > 10_240) {
    return NextResponse.json({ error: 'Payload trop volumineux' }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Paramètres invalides', details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  // Étape 1 : scoring (cache Redis — rapide en cache chaud)
  let scoringError: string | null = null;
  let score: Awaited<ReturnType<typeof calculateCrisisScore>> | null = null;
  try {
    const country = findCountry(parsed.data.countryCode);
    if (!country) {
      return NextResponse.json({ error: 'Destination inconnue' }, { status: 400 });
    }

    const profile = {
      departureCountry: 'FR',
      budget: parsed.data.budget ?? 1500,
      duration: parsed.data.duration ?? 7,
      period: 'flexible',
      travelType: parsed.data.travelType ?? ('solo' as const),
      mode: 'standard' as const,
    };
    score = await calculateCrisisScore(country, profile);
  } catch (err) {
    scoringError = err instanceof Error ? err.message : String(err);
    console.error('[API/country-guide] scoring failed', {
      countryCode: parsed.data.countryCode,
      error: scoringError,
    });
    return NextResponse.json({ error: 'Erreur lors du calcul du score' }, { status: 500 });
  }

  // Étape 2 : faits terrain Perplexity (avec cache 6h)
  const factsResult = await getPerplexityCountryFacts(parsed.data.countryCode, parsed.data.countryName);
  if (factsResult.source === 'fallback') {
    console.warn('[API/country-guide] Perplexity facts en fallback', {
      countryCode: parsed.data.countryCode,
      error: factsResult.error ?? 'api key absente ou erreur réseau',
    });
  }

  // Étape 3 : génération guide Claude (streaming, cache 6h)
  let guide: Awaited<ReturnType<typeof generatePremiumCountryGuide>>;
  try {
    guide = await generatePremiumCountryGuide(score, factsResult.data, {
      travelType: parsed.data.travelType ?? 'solo',
      budget: parsed.data.budget,
      duration: parsed.data.duration,
      from: parsed.data.from,  // TRAVEL-DATES-001
      to:   parsed.data.to,    // TRAVEL-DATES-001
    });
  } catch (err) {
    console.error('[API/country-guide] Claude generation failed', {
      countryCode: parsed.data.countryCode,
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: 'Erreur lors de la génération du guide' }, { status: 500 });
  }

  const durationMs = Date.now() - t0;

  // Log résumé — toujours actif, signal clé pour mesurer la santé de la route
  console.log('[API/country-guide] terminé', {
    countryCode: parsed.data.countryCode,
    factsSource: factsResult.source,        // 'live' | 'fallback'
    guideFallback: guide.isFallback ?? false, // true si Claude a timeouté ou produit un texte trop court
    durationMs,
    userId: user.id,
  });

  const response: CountryGuideApiResponse = {
    guide,
    meta: { premiumOnly: true, source: 'ai', factsSource: factsResult.source === 'live' ? 'live' : 'derived' },
  };
  return NextResponse.json(response, { status: 200 });
}
