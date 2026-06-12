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

// ── ANALYZE-PROFILE-001 — le travelType module la praticité (family ≠ solo) ──────

describe('calculateCrisisScore — profil voyageur (ANALYZE-PROFILE-001)', () => {
  // Cameroun : visa embassy_simple (score 40, forte friction) → terrain où une
  // famille est nettement plus pénalisée qu'un solo sur la praticité.
  const cm = { code: 'CM', name: 'Cameroun', meaeSlug: 'cameroun', iso3: 'CMR', acledName: 'Cameroon' };
  // Portugal : visa 100 + vol direct CDG → aucune friction → modificateur nul.
  const pt = { code: 'PT', name: 'Portugal', meaeSlug: 'portugal', iso3: 'PRT', acledName: 'Portugal' };

  const mk = (travelType: UserProfile['travelType']): UserProfile =>
    ({ departureCountry: 'FR', budget: 1500, duration: 7, period: 'flexible', travelType, mode: 'standard' }) as UserProfile;

  it('family obtient une praticité STRICTEMENT inférieure à solo sur une destination à friction', async () => {
    const solo   = await calculateCrisisScore(cm, mk('solo'));
    const family = await calculateCrisisScore(cm, mk('family'));
    expect(family.practicality.value).toBeLessThan(solo.practicality.value);
  });

  it('family obtient un score TOTAL inférieur ou égal à solo (praticité pèse 10%)', async () => {
    const solo   = await calculateCrisisScore(cm, mk('solo'));
    const family = await calculateCrisisScore(cm, mk('family'));
    expect(family.total).toBeLessThanOrEqual(solo.total);
    // Et au moins un sous-score diffère réellement (preuve que le profil n'est pas perdu).
    expect(family.practicality.value).not.toBe(solo.practicality.value);
  });

  it('couple est pénalisé moins que family (moitié de la sensibilité)', async () => {
    const solo   = await calculateCrisisScore(cm, mk('solo'));
    const couple = await calculateCrisisScore(cm, mk('couple'));
    const family = await calculateCrisisScore(cm, mk('family'));
    expect(couple.practicality.value).toBeLessThan(solo.practicality.value);
    expect(couple.practicality.value).toBeGreaterThan(family.practicality.value);
  });

  it('nomad et solo sont identiques (aucun modificateur)', async () => {
    const solo  = await calculateCrisisScore(cm, mk('solo'));
    const nomad = await calculateCrisisScore(cm, mk('nomad'));
    expect(nomad.practicality.value).toBe(solo.practicality.value);
  });

  it("sans friction (Portugal : visa 100 + vol direct), family = solo (pas de pénalité gratuite)", async () => {
    const solo   = await calculateCrisisScore(pt, mk('solo'));
    const family = await calculateCrisisScore(pt, mk('family'));
    expect(family.practicality.value).toBe(solo.practicality.value);
  });

  it("le profil n'ajoute AUCUN appel réseau (Teleport toujours 1 appel/pays)", async () => {
    teleportCalls = 0;
    await calculateCrisisScore(cm, mk('family'));
    expect(teleportCalls).toBe(1);
  });
});
