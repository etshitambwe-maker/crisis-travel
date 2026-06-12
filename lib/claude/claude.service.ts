import Anthropic from '@anthropic-ai/sdk';
import { withCache, buildCacheKey } from '@/lib/cache/redis';
import { logger } from '@/lib/utils/logger';
import type { CrisisScore, UserProfile, ItineraryRequest, ItineraryResult, BudgetLevel } from '@/types/crisis.types';

// maxRetries: 0 — sans ça, le SDK Anthropic réessaie (jusqu'à 2x) sur timeout/erreur,
// ce qui transformait le timeout de 8s en ~25s d'attente sur le chemin critique
// /api/analyze (GOAL-034). Un échec doit être immédiat ; les fallbacks gèrent la suite.
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 0 });

/** Budget dur (ms) pour detectOpportunities — au-delà, on renvoie [] et on rend la main. */
const OPPORTUNITIES_HARD_TIMEOUT_MS = 8000;

function buildFallbackNarrative(score: CrisisScore): string {
  const status = score.status === 'ideal' ? 'idéale' :
    score.status === 'recommended' ? 'recommandée' :
    score.status === 'possible' ? 'possible avec précaution' : 'déconseillée';
  const budgetStatus = score.budget.value >= 70 ? 'favorable pour les voyageurs européens' :
    score.budget.value >= 50 ? 'dans la moyenne' : 'élevé pour cette région';
  const geoStatus = score.geopolitical.value >= 70 ? 'stable' :
    score.geopolitical.value >= 50 ? 'globalement stable avec quelques tensions' : 'tendue';

  return `**${score.country}** obtient un CrisisScore de ${score.total}/100, ce qui en fait une destination ${status} au moment de cette analyse.

Sur le plan sécuritaire, le score de ${score.security.value}/100 reflète le niveau d'alerte des sources officielles (MEAE, State Dept, FCDO). La situation géopolitique est ${geoStatus}, avec un indice de stabilité à ${score.geopolitical.value}/100. ${score.geopolitical.details.trend === 'improving' ? "La tendance est à l'amélioration." : score.geopolitical.details.trend === 'deteriorating' ? 'La situation tend à se dégrader — vigilance recommandée.' : 'La situation est stable.'}

Côté budget, le pouvoir d'achat est ${budgetStatus}. La variation du taux de change EUR représente ${score.budget.details.currencyVariation ?? 0}% sur 12 mois. Score budgétaire global : ${score.budget.value}/100.

**Risques résiduels :**
- Vérifiez toujours les dernières alertes officielles sur diplomatie.gouv.fr avant le départ
- Souscrivez une assurance voyage couvrant les rapatriements et les crises politiques
- Consultez les communautés de voyageurs récents pour un retour terrain à jour`;
}

export async function generateDestinationNarrative(
  score: CrisisScore,
  profile: UserProfile
): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return buildFallbackNarrative(score);
  }

  const key = buildCacheKey('claude-narrative', score.countryCode, String(Math.floor(score.total / 5)));
  try {
    const { data, fromCache } = await withCache(
      key,
      async () => {
        const t0 = Date.now();
        const msg = await client.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 700,
          messages: [
            {
              role: 'user',
              content: `Tu es un expert en géopolitique et voyage. Analyse ${score.country} pour un voyageur ${profile.travelType}, budget ${profile.budget}€, ${profile.duration} jours.

Données actuelles :
- CrisisScore global : ${score.total}/100 (${score.status})
- Sécurité : ${score.security.value}/100 | Sources : ${score.security.source}
- Géopolitique : ${score.geopolitical.value}/100 | Tendance : ${score.geopolitical.details.trend ?? 'stable'}
- Budget : ${score.budget.value}/100 | Change EUR : ${score.budget.details.currencyVariation ?? 0}% sur 12 mois
- Repas bon marché : ~${score.budget.details.mealCheap ?? '?'}€ | Hôtel moyen : ~${score.budget.details.hotelAvg ?? '?'}€/nuit

Rédige en français 3 paragraphes courts et factuels :
1. Pourquoi ce pays est ${score.total >= 60 ? 'recommandé' : 'déconseillé'} maintenant
2. Contexte géopolitique concret pour le voyageur
3. Réalité du budget sur place

Termine par : **Risques résiduels :** [3 risques concrets, une ligne chacun]`,
            },
          ],
        });
        logger.api('Claude', score.countryCode, Date.now() - t0, false);
        return (msg.content[0] as { text: string }).text;
      },
      3600
    );
    logger.api('Claude', score.countryCode, 0, fromCache);
    return data;
  } catch (error) {
    logger.error('Claude', error);
    return buildFallbackNarrative(score);
  }
}

type Opportunity = { countryCode: string; type: string; explanation: string; estimatedSaving: number };

async function fetchOpportunities(scores: CrisisScore[], budget: number): Promise<Opportunity[]> {
  const candidates = scores.filter((s) => s.total >= 55).slice(0, 12);
  const t0 = Date.now();
  const msg = await client.messages.create(
    {
      model: 'claude-sonnet-4-6',
      max_tokens: 500,
      messages: [
        {
          role: 'user',
          content: `Budget voyageur : ${budget}€. Pays avec bon CrisisScore :
${candidates.map((s) => `${s.country} (${s.countryCode}): score=${s.total}, budget=${s.budget.value}, change=${s.budget.details.currencyVariation ?? 0}%`).join('\n')}

Identifie 3 pays avec une opportunité économique exceptionnelle pour un Européen.
Réponds UNIQUEMENT avec ce JSON valide, sans markdown :
[{"countryCode":"XX","type":"currency|cheap_flights|jackpot","explanation":"<1 phrase max>","estimatedSaving":<euros entier>}]`,
        },
      ],
    },
    { timeout: OPPORTUNITIES_HARD_TIMEOUT_MS }
  );
  logger.api('Claude-Opportunities', 'global', Date.now() - t0, false);
  const text = (msg.content[0] as { text: string }).text.trim();
  return JSON.parse(text);
}

// ── Itinerary generation (ITINERARY-002) ─────────────────────────────────────

const ITINERARY_HARD_TIMEOUT_MS = 30000;

function classifyBudget(amount: number, days: number): BudgetLevel {
  const perDay = amount / days;
  if (perDay < 60) return 'low';
  if (perDay < 150) return 'medium';
  if (perDay < 350) return 'high';
  return 'luxury';
}

function buildItineraryFallback(req: ItineraryRequest, days: number): ItineraryResult {
  const now = new Date().toISOString();
  const country = req.countryName ?? req.countryCode ?? 'cette destination';
  return {
    countryCode: req.countryCode ?? '',
    countryName: req.countryName ?? req.countryCode ?? '',
    cityOrRegion: req.cityOrRegion,
    durationDays: days,
    budget: {
      amount: req.budget ?? 0,
      currency: req.currency ?? 'EUR',
      level: req.budget ? classifyBudget(req.budget, days) : 'medium',
    },
    days: Array.from({ length: days }, (_, i) => ({
      day: i + 1,
      title: `Jour ${i + 1} à ${country}`,
      summary: "Itinéraire temporairement indisponible. Consultez un guide de voyage local.",
      morning: "À planifier selon vos préférences.",
      afternoon: "À planifier selon vos préférences.",
      evening: "À planifier selon vos préférences.",
      estimatedBudget: "Estimation non disponible.",
      safetyNote: "Vérifiez les recommandations officielles sur diplomatie.gouv.fr avant votre départ.",
    })),
    globalAdvice: ["Service temporairement indisponible. Réessayez dans quelques instants."],
    safetyDisclaimer:
      "Cet itinéraire est généré à titre indicatif uniquement. Crisis Travel ne garantit pas l'exactitude ni la sécurité des informations. Consultez diplomatie.gouv.fr et vérifiez les conditions locales avant tout départ.",
    officialSourceReminder:
      "Vérifiez toujours les informations officielles sur diplomatie.gouv.fr avant votre départ.",
    generatedAt: now,
  };
}

export async function generateItinerary(req: ItineraryRequest): Promise<ItineraryResult> {
  const country = req.countryName ?? req.countryCode ?? 'destination inconnue';
  const days = req.from && req.to
    ? Math.max(1, Math.ceil((new Date(req.to).getTime() - new Date(req.from).getTime()) / 86400000))
    : 7;
  const budgetAmount = req.budget ?? 1000;
  const currency = req.currency ?? 'EUR';
  const travelers = req.travelers ?? 1;
  const meaeLevel = req.riskContext?.meaeLevel ?? 1;
  const perDay = Math.round(budgetAmount / days);

  if (!process.env.ANTHROPIC_API_KEY) {
    return buildItineraryFallback(req, days);
  }

  const cacheKey = buildCacheKey(
    'itinerary',
    req.countryCode ?? req.countryName ?? 'unknown',
    String(days),
    String(Math.floor(budgetAmount / 100) * 100),
    req.travelType ?? 'solo'
  );

  const safetyHeader = meaeLevel >= 3
    ? `⚠️ NIVEAU DE VIGILANCE ÉLEVÉ (MEAE ${meaeLevel}/4) : Renforce les avertissements de sécurité à chaque jour. Évite les zones explicitement déconseillées. Rappelle systématiquement les précautions officielles.`
    : meaeLevel === 2
    ? `ℹ️ Vigilance normale (MEAE ${meaeLevel}/4) : Inclure des notes de sécurité pratiques sans dramatisation.`
    : `✅ Destination globalement sûre (MEAE ${meaeLevel}/4) : Rappels sécurité standards.`;

  const dateContext = req.from && req.to
    ? `Dates : du ${req.from} au ${req.to} (${days} jours).`
    : `Durée estimée : ${days} jours (dates non précisées).`;

  const prefContext = req.preferences && req.preferences.length > 0
    ? `Préférences : ${req.preferences.join(', ')}.`
    : '';

  const prompt = `Tu es un expert en planification de voyages responsables.

${safetyHeader}

Planifie un itinéraire de voyage pour les données suivantes :
- Destination : ${country}${req.cityOrRegion ? ` (région/ville : ${req.cityOrRegion})` : ''}
- ${dateContext}
- Budget total : ${budgetAmount} ${currency} pour ${travelers} voyageur${travelers > 1 ? 's' : ''} (soit ~${perDay} ${currency}/jour)
${prefContext}

RÈGLES ABSOLUES (à respecter strictement) :
1. Ne prétends PAS accéder à des données en temps réel (prix de vols, météo live, disponibilités).
2. N'invente aucune source officielle ni chiffre de sécurité précis.
3. Ne promets pas de sécurité absolue.
4. Formule les activités au conditionnel ou avec "typiquement" (ex: "vous pourriez visiter", "les marchés proposent généralement").
5. N'inclus aucun numéro de téléphone, adresse précise ou prix garantis.
6. Si niveau MEAE ${meaeLevel} >= 3, intègre des avertissements de sécurité renforcés à chaque jour.
7. Rappelle dans globalAdvice de vérifier diplomatie.gouv.fr avant le départ.

Réponds UNIQUEMENT avec ce JSON valide (sans markdown, sans backticks) :
{
  "days": [
    {
      "day": 1,
      "title": "...",
      "summary": "...",
      "morning": "...",
      "afternoon": "...",
      "evening": "...",
      "estimatedBudget": "...",
      "safetyNote": "..."
    }
  ],
  "globalAdvice": ["...", "..."],
  "safetyDisclaimer": "...",
  "officialSourceReminder": "Vérifiez toujours les informations officielles sur diplomatie.gouv.fr avant votre départ."
}

Génère exactement ${days} jours dans le tableau "days".`;

  try {
    const { data } = await withCache(
      cacheKey,
      async () => {
        const t0 = Date.now();
        let timer: ReturnType<typeof setTimeout> | undefined;

        const hardTimeout = new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(new Error(`itinerary hard timeout ${ITINERARY_HARD_TIMEOUT_MS}ms`)),
            ITINERARY_HARD_TIMEOUT_MS
          );
        });

        try {
          const msg = await Promise.race([
            client.messages.create({
              model: 'claude-sonnet-4-6',
              max_tokens: 4000,
              messages: [{ role: 'user', content: prompt }],
            }),
            hardTimeout,
          ]);
          logger.api('Claude-Itinerary', req.countryCode ?? 'unknown', Date.now() - t0, false);
          return (msg.content[0] as { text: string }).text;
        } finally {
          if (timer) clearTimeout(timer);
        }
      },
      7200 // 2h cache
    );

    const parsed = JSON.parse(data) as {
      days: ItineraryResult['days'];
      globalAdvice: string[];
      safetyDisclaimer: string;
      officialSourceReminder: string;
    };

    if (!Array.isArray(parsed.days) || parsed.days.length === 0) {
      throw new Error('itinerary: malformed response — no days array');
    }

    return {
      countryCode: req.countryCode ?? '',
      countryName: req.countryName ?? req.countryCode ?? '',
      cityOrRegion: req.cityOrRegion,
      durationDays: days,
      budget: {
        amount: budgetAmount,
        currency,
        level: classifyBudget(budgetAmount, days),
      },
      days: parsed.days,
      globalAdvice: Array.isArray(parsed.globalAdvice) ? parsed.globalAdvice : [],
      safetyDisclaimer: parsed.safetyDisclaimer ??
        "Cet itinéraire est généré à titre indicatif. Vérifiez les conditions locales et les recommandations officielles avant tout départ.",
      officialSourceReminder: parsed.officialSourceReminder ??
        "Vérifiez toujours les informations officielles sur diplomatie.gouv.fr avant votre départ.",
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    logger.error('Claude-Itinerary', error);
    return buildItineraryFallback(req, days);
  }
}

// ─────────────────────────────────────────────────────────────────────────────

export async function detectOpportunities(
  scores: CrisisScore[],
  budget: number
): Promise<Opportunity[]> {
  if (!process.env.ANTHROPIC_API_KEY) return [];

  // Double verrou (GOAL-034) : maxRetries:0 sur le client + Promise.race hard ici.
  // Même si le SDK déborde son propre timeout, /api/analyze récupère la main au plus
  // tard à OPPORTUNITIES_HARD_TIMEOUT_MS et renvoie [] — les destinations restent
  // affichées, seul le bloc « opportunités » est omis.
  let timer: ReturnType<typeof setTimeout> | undefined;
  const hardTimeout = new Promise<Opportunity[]>((resolve) => {
    timer = setTimeout(() => {
      logger.error('Claude-Opportunities', new Error(`hard timeout ${OPPORTUNITIES_HARD_TIMEOUT_MS}ms — fallback []`));
      resolve([]);
    }, OPPORTUNITIES_HARD_TIMEOUT_MS);
  });

  try {
    return await Promise.race([
      fetchOpportunities(scores, budget).catch((error) => {
        logger.error('Claude-Opportunities', error);
        return [] as Opportunity[];
      }),
      hardTimeout,
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
