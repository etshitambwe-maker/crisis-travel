import { describe, it, expect, vi, beforeEach } from 'vitest';

// Compteur d'appels Teleport — le cœur du test GOAL-033 (dédup : 1 appel/pays).
let teleportCalls = 0;

// Mock de tous les services externes appelés par calculateCrisisScore.
// Chacun renvoie un ServiceResult 'live' minimal et déterministe.
vi.mock('@/lib/services/security/meae.service', () => ({
  getMEAEScore: () => Promise.resolve({ data: { score: 80, level: 1 }, source: 'live' }),
}));
vi.mock('@/lib/services/security/acled.service', () => ({
  getACLEDScore: () => Promise.resolve({ data: { score: 80, incidents: 0, fatalities: 0 }, source: 'live' }),
}));
vi.mock('@/lib/services/security/stateDept.service', () => ({
  getStateDeptScore: () => Promise.resolve({ data: { score: 80, level: 1 }, source: 'live' }),
}));
vi.mock('@/lib/services/security/nasaEonet.service', () => ({
  getNasaEonetScore: () => Promise.resolve({ data: { score: 90, activeEvents: 0, categories: [] }, source: 'live' }),
}));
vi.mock('@/lib/services/geopolitical/perplexity.service', () => ({
  getPerplexityGeoScore: () => Promise.resolve({ data: { stabilityScore: 70, summary: '', mainRisks: [], recentEvents: [], trend: 'stable' }, source: 'live' }),
}));
vi.mock('@/lib/services/geopolitical/worldbank.service', () => ({
  getWorldBankScore: () => Promise.resolve({ data: { score: 70 }, source: 'live' }),
}));
vi.mock('@/lib/services/geopolitical/gdelt.service', () => ({
  getGdeltScore: () => Promise.resolve({ data: { score: 70, tone: 0, articles: 0 }, source: 'live' }),
}));
vi.mock('@/lib/services/budget/frankfurter.service', () => ({
  getFrankfurterScore: () => Promise.resolve({ data: { score: 60, currency: 'EUR', variation: 0 }, source: 'live' }),
}));
vi.mock('@/lib/services/budget/numbeo.service', () => ({
  getNumbeoScore: () => Promise.resolve({ data: { score: 60, index: 55, mealCheap: 8, hotelAvg: 60 }, source: 'live' }),
}));
vi.mock('@/lib/services/budget/teleport.service', () => ({
  getTeleportScore: () => {
    teleportCalls++;
    return Promise.resolve({ data: { score: 60, costIndex: 55, safetyScore: 70, healthcareScore: 70 }, source: 'live' });
  },
}));

import { calculateCrisisScore } from './crisisScore.service';
import type { UserProfile } from '@/types/crisis.types';

const country = { code: 'PT', name: 'Portugal', meaeSlug: 'portugal', iso3: 'PRT', acledName: 'Portugal' };
const profile = { departureCountry: 'FR', budget: 1500, duration: 7, period: 'flexible', travelType: 'solo', mode: 'standard' } as unknown as UserProfile;

beforeEach(() => { teleportCalls = 0; });

describe('calculateCrisisScore — dédup Teleport (GOAL-033)', () => {
  it("n'appelle getTeleportScore qu'UNE seule fois par pays", async () => {
    await calculateCrisisScore(country, profile);
    expect(teleportCalls).toBe(1); // avant GOAL-033 : 2 (budget + praticité)
  });

  it('produit un score cohérent (formule inchangée, total dans [0,100])', async () => {
    const r = await calculateCrisisScore(country, profile);
    expect(r.total).toBeGreaterThanOrEqual(0);
    expect(r.total).toBeLessThanOrEqual(100);
    expect(r.countryCode).toBe('PT');
    // praticité enrichie par Teleport live → source 'live'
    expect(r.practicality.value).toBeGreaterThan(0);
  });
});
