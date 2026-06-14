import { describe, it, expect, vi } from 'vitest';

/**
 * PREMIUM-GUIDE-001A — Le scoring DOIT faire remonter les `mainRisks` et
 * `recentEvents` produits par Perplexity (déjà payés) jusqu'au CrisisScore final,
 * au lieu de les jeter dans calcGeopolitical. Ces tableaux alimentent le bloc
 * « guide » premium « Aller plus loin », sans aucun appel API supplémentaire.
 *
 * Mock dédié (séparé de crisisScore.test.ts qui fige mainRisks/recentEvents à [])
 * pour pouvoir renvoyer des tableaux NON vides et vérifier qu'ils survivent.
 */

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
  getPerplexityGeoScore: () => Promise.resolve({
    data: {
      stabilityScore: 65,
      summary: 'Situation stable mais quelques tensions ponctuelles.',
      mainRisks: ['Pickpockets dans les transports touristiques', 'Manifestations occasionnelles au centre-ville'],
      recentEvents: ['Grève des transports annoncée le mois dernier'],
      trend: 'stable',
    },
    source: 'live',
  }),
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
  getTeleportScore: () => Promise.resolve({ data: { score: 60, costIndex: 55, safetyScore: 70, healthcareScore: 70 }, source: 'live' }),
}));

import { calculateCrisisScore } from './crisisScore.service';
import type { UserProfile } from '@/types/crisis.types';

const country = { code: 'PT', name: 'Portugal', meaeSlug: 'portugal', iso3: 'PRT', acledName: 'Portugal' };
const profile = { departureCountry: 'FR', budget: 1500, duration: 7, period: 'flexible', travelType: 'solo', mode: 'standard' } as unknown as UserProfile;

describe('calculateCrisisScore — remonte les risques/événements Perplexity (PREMIUM-GUIDE-001A)', () => {
  it('expose mainRisks de Perplexity dans CrisisScore.liveRisks', async () => {
    const r = await calculateCrisisScore(country, profile);
    expect(r.liveRisks).toEqual([
      'Pickpockets dans les transports touristiques',
      'Manifestations occasionnelles au centre-ville',
    ]);
  });

  it('expose recentEvents de Perplexity dans CrisisScore.recentEvents', async () => {
    const r = await calculateCrisisScore(country, profile);
    expect(r.recentEvents).toEqual(['Grève des transports annoncée le mois dernier']);
  });

  it('ne casse pas la formule de score (total reste dans [0,100])', async () => {
    const r = await calculateCrisisScore(country, profile);
    expect(r.total).toBeGreaterThanOrEqual(0);
    expect(r.total).toBeLessThanOrEqual(100);
  });
});
