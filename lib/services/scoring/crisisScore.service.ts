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
  sources: Array<'live' | 'fallback'>,
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
    withTimeout(getPerplexityGeoScore(c.code, c.name), 9000, PERP_FALLBACK),
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

async function calcBudget(c: CountryInfo, _profile: UserProfile): Promise<SubScore> {
  const [r_fx, r_numbeo, r_teleport] = await Promise.allSettled([
    getFrankfurterScore(c.code),
    getNumbeoScore(c.code),
    getTeleportScore(c.code),
  ]);
  const fx       = resolveSettled(r_fx,       { score: 50, currency: '?', variation: 0 });
  const numbeo   = resolveSettled(r_numbeo,   { score: 50, index: 55, mealCheap: 8, hotelAvg: 60 });
  const teleport = resolveSettled(r_teleport, { score: 50, costIndex: 55, safetyScore: 50, healthcareScore: 50 });

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

async function calcPracticality(c: CountryInfo): Promise<SubScore> {
  try {
    const r_teleport = await getTeleportScore(c.code);
    if (r_teleport.source === 'fallback') {
      return buildSubScore(65, ['fallback' as const], { note: 'Données Teleport indisponibles' });
    }
    const value = r_teleport.data.healthcareScore * 0.50 + r_teleport.data.safetyScore * 0.30 + 65 * 0.20;
    return buildSubScore(value, ['live' as const], {
      healthcareScore: r_teleport.data.healthcareScore,
      safetyScore:     r_teleport.data.safetyScore,
    });
  } catch {
    return buildSubScore(65, ['fallback' as const], { note: 'Données Teleport indisponibles' });
  }
}

export async function calculateCrisisScore(c: CountryInfo, profile: UserProfile): Promise<CrisisScore> {
  const [security, geopolitical, budget, practicality] = await Promise.all([
    calcSecurity(c),
    calcGeopolitical(c),
    calcBudget(c, profile),
    calcPracticality(c),
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
