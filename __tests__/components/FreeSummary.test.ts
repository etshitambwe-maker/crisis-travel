import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { buildFreeSummary, extractNarrativeLead } from '@/lib/services/summary/freeSummary';
import type { CrisisScore } from '@/types/crisis.types';

// PREMIUM-FLOW-001D — Synthèse gratuite de base.
// La page /destination/[country] doit afficher une synthèse VISIBLE et GRATUITE,
// construite en priorité sur les données structurées du score (fiables) et,
// quand c'est possible, enrichie par un extrait robuste du 1er paragraphe de la
// narrative Claude. Si la narrative manque ou est mal formée, la synthèse reste
// robuste grâce aux seules données structurées.

function read(rel: string): string {
  return readFileSync(resolve(process.cwd(), rel), 'utf-8');
}

// ── Fixture : un CrisisScore minimal mais réaliste ────────────────────────────
function sub(value: number, details: Record<string, number | string> = {}) {
  return { value, source: 'live' as const, confidence: 'high' as const, details };
}
function makeScore(overrides: Partial<CrisisScore> = {}): CrisisScore {
  const base: CrisisScore = {
    country: 'Portugal',
    countryCode: 'PT',
    total: 82,
    status: 'ideal',
    confidence: 'high',
    calculatedAt: new Date().toISOString(),
    security: sub(85, { meaeLevel: 1 }),
    geopolitical: sub(80, { trend: 'stable' }),
    budget: sub(72, { currencyVariation: 2, mealCheap: 12, hotelAvg: 70 }),
    practicality: sub(78),
  };
  return { ...base, ...overrides };
}

describe('PREMIUM-FLOW-001D — buildFreeSummary (synthèse gratuite robuste)', () => {
  it('produit toujours un verdict, un niveau de risque et des sous-scores depuis les données structurées', () => {
    const s = buildFreeSummary(makeScore(), null);
    expect(s.destination).toBe('Portugal');
    expect(s.verdict.length).toBeGreaterThan(0);
    expect(s.riskLevel.length).toBeGreaterThan(0);
    // points forts / vigilance dérivés des sous-scores
    expect(Array.isArray(s.strengths)).toBe(true);
    expect(Array.isArray(s.watchpoints)).toBe(true);
    // au moins un conseil essentiel
    expect(s.essentialTips.length).toBeGreaterThanOrEqual(1);
  });

  it('est robuste SANS narrative (lead vide, pas de crash)', () => {
    const s = buildFreeSummary(makeScore(), null);
    expect(s.lead).toBe('');
    // la synthèse reste exploitable
    expect(s.verdict.length).toBeGreaterThan(0);
  });

  it('classe un sous-score élevé en force et un sous-score bas en point de vigilance', () => {
    const s = buildFreeSummary(
      makeScore({
        security: sub(90, { meaeLevel: 1 }),
        budget: sub(30),
      }),
      null,
    );
    expect(s.strengths.join(' ')).toMatch(/Sécurité/i);
    expect(s.watchpoints.join(' ')).toMatch(/Budget/i);
  });

  it('extrait le 1er paragraphe de la narrative quand elle est bien formée', () => {
    const narrative =
      '**Portugal** obtient un excellent score grâce à sa stabilité.\n\nDeuxième paragraphe sur la géopolitique.\n\n**Risques résiduels :**\n- a\n- b';
    const lead = extractNarrativeLead(narrative);
    expect(lead.length).toBeGreaterThan(0);
    expect(lead).not.toMatch(/Risques résiduels/i);
    expect(lead).not.toContain('\n\n'); // un seul paragraphe
  });

  it('extractNarrativeLead ne crash pas sur entrée vide/nulle et retourne une chaîne', () => {
    expect(extractNarrativeLead('')).toBe('');
    expect(extractNarrativeLead(undefined as unknown as string)).toBe('');
    expect(typeof extractNarrativeLead('texte sans double saut')).toBe('string');
  });

  it('intègre le lead narratif dans la synthèse quand fourni', () => {
    const narrative = 'Premier paragraphe lisible et informatif.\n\nSuite premium.';
    const s = buildFreeSummary(makeScore(), narrative);
    expect(s.lead.length).toBeGreaterThan(0);
    expect(s.lead).not.toContain('Suite premium');
  });
});

// ── PREMIUM-FLOW-001E — vraie synthèse basique en PARAGRAPHE ───────────────────
// La synthèse gratuite doit comporter un paragraphe narratif lisible et
// auto-suffisant (pas une liste), construit en priorité sur les données
// structurées et DISPONIBLE même sans narrative Claude.
describe('PREMIUM-FLOW-001E — buildFreeSummary expose un paragraphe basicSynthesis', () => {
  it('produit un paragraphe de synthèse basique non vide et suffisamment long', () => {
    const s = buildFreeSummary(makeScore(), null);
    expect(typeof s.basicSynthesis).toBe('string');
    // un vrai paragraphe, pas une phrase de 3 mots
    expect(s.basicSynthesis.length).toBeGreaterThanOrEqual(120);
    // mentionne la destination et est une vraie phrase (ponctuation)
    expect(s.basicSynthesis).toContain('Portugal');
    expect(s.basicSynthesis).toMatch(/\.\s*$|\./);
  });

  it('le paragraphe EXISTE même si la narrative Claude est absente (indépendance)', () => {
    const withNarr = buildFreeSummary(makeScore(), 'Para narrative.\n\nSuite.').basicSynthesis;
    const without = buildFreeSummary(makeScore(), null).basicSynthesis;
    // sans narrative, le paragraphe reste complet et long
    expect(without.length).toBeGreaterThanOrEqual(120);
    // le contenu structurel ne disparaît pas en l'absence de narrative
    expect(without).toContain('Portugal');
    expect(withNarr.length).toBeGreaterThanOrEqual(120);
  });

  it('reflète la SITUATION selon le score (favorable / à surveiller / déconseillée)', () => {
    const good = buildFreeSummary(makeScore({ total: 85, status: 'ideal' }), null).basicSynthesis;
    const bad = buildFreeSummary(
      makeScore({ total: 28, status: 'discouraged', security: sub(20, { meaeLevel: 4 }) }),
      null,
    ).basicSynthesis;
    expect(good).toMatch(/favorable|sûr|propice|recommandé/i);
    expect(bad).toMatch(/déconseill|risqué|élevé|prudence|éviter/i);
  });

  it('intègre le profil voyageur quand il est fourni', () => {
    const s = buildFreeSummary(makeScore(), null, { travelType: 'family' });
    expect(s.basicSynthesis).toMatch(/famille|familial/i);
  });

  it('reste lisible sans profil (pas de "undefined" dans le texte)', () => {
    const s = buildFreeSummary(makeScore(), null);
    expect(s.basicSynthesis).not.toMatch(/undefined|null|NaN/);
  });
});

// ── Source-assertions : le helper doit exister et rester pur (pas de fetch) ────
describe('PREMIUM-FLOW-001D — freeSummary reste pur (aucun appel réseau)', () => {
  const SRC = 'lib/services/summary/freeSummary.ts';
  it('n\'effectue aucun appel API supplémentaire (pas de fetch / client Anthropic)', () => {
    const src = read(SRC);
    expect(src).not.toMatch(/\bfetch\s*\(/);
    expect(src).not.toMatch(/Anthropic|client\.messages/);
  });
});
