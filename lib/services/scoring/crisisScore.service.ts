import { getMEAEScore } from '@/lib/services/security/meae.service';
import { getACLEDScore } from '@/lib/services/security/acled.service';
import { getStateDeptScore } from '@/lib/services/security/stateDept.service';
import { getReliefWebScore } from '@/lib/services/security/reliefweb.service';
import { getPerplexityGeoScore } from '@/lib/services/geopolitical/perplexity.service';
import { getWorldBankScore } from '@/lib/services/geopolitical/worldbank.service';
import { getFrankfurterScore } from '@/lib/services/budget/frankfurter.service';
import { getNumbeoScore } from '@/lib/services/budget/numbeo.service';
import { clamp, getScoreStatus } from '@/types/crisis.types';
import type { CrisisScore, SubScore, UserProfile } from '@/types/crisis.types';
import type { ServiceResult } from '@/types/api.types';

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
  const [r_meae, r_acled, r_state, r_relief] = await Promise.allSettled([
    getMEAEScore(c.code, c.meaeSlug),
    getACLEDScore(c.code, c.acledName),
    getStateDeptScore(c.code),
    getReliefWebScore(c.code, c.iso3),
  ]);
  const meae = resolveSettled(r_meae, { score: 70, level: 2 });
  const acled = resolveSettled(r_acled, { score: 50, incidents: 0, fatalities: 0 });
  const state = resolveSettled(r_state, { score: 70, level: 2 });
  const relief = resolveSettled(r_relief, { score: 100, activeCrises: 0 });

  const value = meae.data.score * 0.35 + acled.data.score * 0.30 + state.data.score * 0.20 + relief.data.score * 0.05 + 70 * 0.10;
  return buildSubScore(value, [meae.source, acled.source, state.source, relief.source], {
    meaeLevel: meae.data.level,
    acledIncidents: acled.data.incidents,
    stateDeptLevel: state.data.level,
    activeCrises: relief.data.activeCrises,
  });
}

async function calcGeopolitical(c: CountryInfo): Promise<SubScore> {
  const [r_perp, r_wb] = await Promise.allSettled([
    getPerplexityGeoScore(c.code, c.name),
    getWorldBankScore(c.code),
  ]);
  const perp = resolveSettled(r_perp, { stabilityScore: 50, summary: '', mainRisks: [], recentEvents: [], trend: 'stable' as const });
  const wb = resolveSettled(r_wb, { score: 50 });

  const value = perp.data.stabilityScore * 0.40 + wb.data.score * 0.25 + 50 * 0.20 + 70 * 0.15;
  return buildSubScore(value, [perp.source, wb.source], {
    perplexityScore: perp.data.stabilityScore,
    trend: perp.data.trend,
    worldBankScore: wb.data.score,
    summary: perp.data.summary,
  });
}

async function calcBudget(c: CountryInfo, _profile: UserProfile): Promise<SubScore> {
  const [r_fx, r_numbeo] = await Promise.allSettled([
    getFrankfurterScore(c.code),
    getNumbeoScore(c.code),
  ]);
  const fx = resolveSettled(r_fx, { score: 50, currency: '?', variation: 0 });
  const numbeo = resolveSettled(r_numbeo, { score: 50, index: 55, mealCheap: 8, hotelAvg: 60 });

  const value = fx.data.score * 0.30 + 50 * 0.30 + numbeo.data.score * 0.25 + 50 * 0.15;
  return buildSubScore(value, [fx.source, numbeo.source], {
    currencyVariation: fx.data.variation,
    currency: fx.data.currency,
    costOfLivingScore: numbeo.data.score,
    mealCheap: numbeo.data.mealCheap,
    hotelAvg: numbeo.data.hotelAvg,
  });
}

function calcPracticality(): SubScore {
  return buildSubScore(65, [], { note: 'Calculé en Phase 2' });
}

export async function calculateCrisisScore(c: CountryInfo, profile: UserProfile): Promise<CrisisScore> {
  const [security, geopolitical, budget] = await Promise.all([
    calcSecurity(c),
    calcGeopolitical(c),
    calcBudget(c, profile),
  ]);
  const practicality = calcPracticality();

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
