import { getMEAEScore } from '@/lib/services/security/meae.service';
import { getACLEDScore } from '@/lib/services/security/acled.service';
import { getStateDeptScore } from '@/lib/services/security/stateDept.service';
import { getNasaEonetScore } from '@/lib/services/security/nasaEonet.service';
import { getPerplexityGeoScore } from '@/lib/services/geopolitical/perplexity.service';
import { getWorldBankScore } from '@/lib/services/geopolitical/worldbank.service';
import { getGdeltScore } from '@/lib/services/geopolitical/gdelt.service';
import { getFrankfurterScore } from '@/lib/services/budget/frankfurter.service';
import { getNumbeoScore } from '@/lib/services/budget/numbeo.service';
import { getTeleportScore } from '@/lib/services/budget/teleport.service';
import { calculatePracticalityScore } from '@/lib/services/scoring/practicality.service';
import { clamp, getScoreStatus } from '@/types/crisis.types';
import type { CrisisScore, SubScore, UserProfile } from '@/types/crisis.types';
import type { ServiceResult, PerplexityGeoAnalysis } from '@/types/api.types';

export interface CountryInfo {
  code: string;
  name: string;
  meaeSlug: string;
  iso3: string;
  acledName: string;
}

function resolveSettled<T>(r: PromiseSettledResult<ServiceResult<T>>, fallbackData: T): ServiceResult<T> {
  if (r.status === 'fulfilled') return r.value;
  return { data: fallbackData, source: 'fallback', error: 'Promise rejected' };
}

function buildSubScore(
  value: number,
  sources: Array<'live' | 'fallback' | 'static'>,
  details: Record<string, number | string>
): SubScore {
  const fallbackCount = sources.filter((s) => s === 'fallback').length;
  return {
    value: clamp(Math.round(value)),
    source: fallbackCount === 0 ? 'live' : fallbackCount === sources.length ? 'fallback' : 'partial',
    confidence: fallbackCount === 0 ? 'high' : fallbackCount <= 1 ? 'medium' : 'low',
    details,
  };
}

async function calcSecurity(c: CountryInfo): Promise<SubScore> {
  const [r_meae, r_acled, r_state, r_eonet] = await Promise.allSettled([
    getMEAEScore(c.code, c.meaeSlug),
    getACLEDScore(c.code, c.acledName),
    getStateDeptScore(c.code),
    getNasaEonetScore(c.code),
  ]);
  const meae  = resolveSettled(r_meae,  { score: 70, level: 2 });
  const acled = resolveSettled(r_acled, { score: 50, incidents: 0, fatalities: 0 });
  const state = resolveSettled(r_state, { score: 70, level: 2 });
  const eonet = resolveSettled(r_eonet, { score: 85, activeEvents: 0, categories: [] });

  // MEAE 35% · ACLED 30% · State Dept 20% · NASA EONET 15%
  const value = meae.data.score * 0.35 + acled.data.score * 0.30 + state.data.score * 0.20 + eonet.data.score * 0.15;
  return buildSubScore(value, [meae.source, acled.source, state.source, eonet.source], {
    meaeLevel:      meae.data.level,
    acledIncidents: acled.data.incidents,
    stateDeptLevel: state.data.level,
    naturalEvents:  eonet.data.activeEvents,
    eventTypes:     eonet.data.categories.slice(0, 3).join(', '),
  });
}

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

async function calcGeopolitical(c: CountryInfo): Promise<SubScore> {
  const PERP_FALLBACK: ServiceResult<PerplexityGeoAnalysis> = {
    data: { stabilityScore: 50, summary: '', mainRisks: [], recentEvents: [], trend: 'stable' },
    source: 'fallback',
  };
  const [r_perp, r_wb, r_gdelt] = await Promise.allSettled([
    withTimeout(getPerplexityGeoScore(c.code, c.name), 6500, PERP_FALLBACK),
    getWorldBankScore(c.code, c.iso3),
    getGdeltScore(c.code),
  ]);
  const perp  = resolveSettled(r_perp,  { stabilityScore: 50, summary: '', mainRisks: [], recentEvents: [], trend: 'stable' as const });
  const wb    = resolveSettled(r_wb,    { score: 50 });
  const gdelt = resolveSettled(r_gdelt, { score: 50, tone: 0, articles: 0 });

  // Perplexity 40% · WorldBank 25% · GDELT 20% · base 15%
  const value = perp.data.stabilityScore * 0.40 + wb.data.score * 0.25 + gdelt.data.score * 0.20 + 70 * 0.15;
  return buildSubScore(value, [perp.source, wb.source, gdelt.source], {
    perplexityScore: perp.data.stabilityScore,
    trend:           perp.data.trend,
    worldBankScore:  wb.data.score,
    gdeltTone:       gdelt.data.tone,
    gdeltArticles:   gdelt.data.articles,
    summary:         perp.data.summary,
  });
}

type TeleportSR = ServiceResult<{ score: number; costIndex: number; safetyScore: number; healthcareScore: number }>;

async function calcBudget(
  c: CountryInfo,
  _profile: UserProfile,
  teleportPromise: Promise<TeleportSR>,
): Promise<SubScore> {
  // Teleport est récupéré UNE seule fois par pays (GOAL-033) et partagé entre budget
  // et praticité via la même promesse — évite un second appel réseau identique.
  const [r_fx, r_numbeo, teleport] = await Promise.all([
    getFrankfurterScore(c.code).catch(() => ({ data: { score: 50, currency: '?', variation: 0 }, source: 'fallback' as const })),
    getNumbeoScore(c.code).catch(() => ({ data: { score: 50, index: 55, mealCheap: 8, hotelAvg: 60 }, source: 'fallback' as const })),
    teleportPromise,
  ]);
  const fx       = r_fx;
  const numbeo   = r_numbeo;

  // Frankfurter 30% · Numbeo statique 20% · Teleport 30% · base 20%
  const costScore = teleport.source === 'live'
    ? teleport.data.score * 0.30 + numbeo.data.score * 0.20
    : numbeo.data.score * 0.50;
  const value = fx.data.score * 0.30 + costScore + 50 * 0.20;

  return buildSubScore(value, [fx.source, numbeo.source, teleport.source], {
    currencyVariation:  fx.data.variation,
    currency:           fx.data.currency,
    costOfLivingScore:  numbeo.data.score,
    teleportCost:       teleport.data.costIndex,
    mealCheap:          numbeo.data.mealCheap,
    hotelAvg:           numbeo.data.hotelAvg,
  });
}

async function calcPracticality(
  c: CountryInfo,
  teleportPromise: Promise<TeleportSR>,
): Promise<SubScore> {
  // Utilise visa + connexions aériennes en base, enrichi par Teleport si disponible.
  // Teleport est partagé via la même promesse que calcBudget (récupéré une seule fois
  // par pays — GOAL-033). La formule et la pondération sont inchangées.
  const baseScore = calculatePracticalityScore(c.code);
  const teleportResult = await teleportPromise;

  if (teleportResult.source === 'live') {
    // Combine visa/vols (60%) + santé/sécurité Teleport (40%)
    const teleportContrib = teleportResult.data.healthcareScore * 0.25 + teleportResult.data.safetyScore * 0.15;
    const combined = baseScore.value * 0.60 + teleportContrib;
    return buildSubScore(combined, ['live'], {
      ...baseScore.details,
      healthcareScore: teleportResult.data.healthcareScore,
      safetyScore:     teleportResult.data.safetyScore,
      teleportCost:    teleportResult.data.costIndex,
    });
  }

  return baseScore;
}

export async function calculateCrisisScore(c: CountryInfo, profile: UserProfile): Promise<CrisisScore> {
  // Teleport récupéré UNE fois par pays (GOAL-033) : la promesse est partagée entre
  // calcBudget et calcPracticality (un seul appel réseau). Les 4 sous-scores restent
  // calculés en parallèle — aucune sérialisation introduite.
  const teleportPromise: Promise<TeleportSR> = getTeleportScore(c.code).catch(
    () => ({ data: { score: 50, costIndex: 55, safetyScore: 50, healthcareScore: 50 }, source: 'fallback' as const }),
  );

  const [security, geopolitical, budget, practicality] = await Promise.all([
    calcSecurity(c),
    calcGeopolitical(c),
    calcBudget(c, profile, teleportPromise),
    calcPracticality(c, teleportPromise),
  ]);

  const total = clamp(Math.round(
    security.value * 0.40 + geopolitical.value * 0.30 + budget.value * 0.20 + practicality.value * 0.10
  ));

  const confidences = [security, geopolitical, budget].map((s) => s.confidence);
  const confidence = confidences.filter((c) => c === 'low').length >= 2 ? 'low'
    : confidences.filter((c) => c === 'medium').length >= 1 ? 'medium'
    : 'high';

  return {
    country: c.name,
    countryCode: c.code,
    total,
    security,
    geopolitical,
    budget,
    practicality,
    status: getScoreStatus(total),
    confidence,
    calculatedAt: new Date().toISOString(),
  };
}
