import { describe, it, expect } from 'vitest';
import { selectCandidates, CANDIDATE_CAP } from './selectCandidates';
import { TARGET_COUNTRIES } from './countries';
import { getHint, STATIC_HINTS } from './staticHints';

const ALL = TARGET_COUNTRIES.map((c) => ({ code: c.code }));

describe('selectCandidates — pré-sélection des pays (GOAL-031)', () => {
  it('tronque à CANDIDATE_CAP (18) en mode non-continent', () => {
    const out = selectCandidates(ALL, 'standard', CANDIDATE_CAP);
    expect(out.length).toBe(CANDIDATE_CAP);
    expect(out.length).toBeLessThan(ALL.length); // on score bien moins que les 66
  });

  it('ne tronque pas quand cap === null (mode continent)', () => {
    const europe = TARGET_COUNTRIES.filter((c) => c.continent === 'Europe').map((c) => ({ code: c.code }));
    const out = selectCandidates(europe, 'standard', null);
    expect(out.length).toBe(europe.length);
  });

  it('mode bunker trie par sécurité décroissante', () => {
    const out = selectCandidates(ALL, 'bunker', CANDIDATE_CAP);
    const secs = out.map((c) => getHint(c.code).security);
    const sortedDesc = [...secs].sort((a, b) => b - a);
    expect(secs).toEqual(sortedDesc);
    // Le 1er candidat a la meilleure sécurité de tout le pool
    const maxSecurity = Math.max(...ALL.map((c) => getHint(c.code).security));
    expect(getHint(out[0].code).security).toBe(maxSecurity);
  });

  it('mode budget_crisis trie par budget décroissant', () => {
    const out = selectCandidates(ALL, 'budget_crisis', CANDIDATE_CAP);
    const budgets = out.map((c) => getHint(c.code).budget);
    expect(budgets).toEqual([...budgets].sort((a, b) => b - a));
  });

  it('mode standard trie par score global décroissant', () => {
    const out = selectCandidates(ALL, 'standard', CANDIDATE_CAP);
    const scores = out.map((c) => getHint(c.code).score);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
  });

  it("ne mute pas le tableau d’entree", () => {
    const input = [...ALL];
    const snapshot = input.map((c) => c.code);
    selectCandidates(input, "bunker", CANDIDATE_CAP);
    expect(input.map((c) => c.code)).toEqual(snapshot);
  });

  it("cap >= longueur renvoie tous les pays tries (pas d’erreur de borne)", () => {
    const out = selectCandidates(ALL, "standard", 9999);
    expect(out.length).toBe(ALL.length);
  });
});

describe("STATIC_HINTS — couverture catalogue (STATIC-HINTS-002)", () => {
  const catalogCodes: string[] = TARGET_COUNTRIES.map((c) => c.code);
  const hintCodes = Object.keys(STATIC_HINTS);

  it("chaque pays du catalogue a un hint dedie (pas de fallback silencieux)", () => {
    const missing = catalogCodes.filter((code) => !hintCodes.includes(code));
    expect(missing).toEqual([]);
  });

  it("aucun code dans STATIC_HINTS est absent du catalogue", () => {
    const extra = hintCodes.filter((code) => !catalogCodes.includes(code));
    expect(extra).toEqual([]);
  });

  it("tous les hints ont des valeurs numeriques dans [0, 100]", () => {
    for (const [code, hint] of Object.entries(STATIC_HINTS)) {
      expect(hint.score,    `${code}.score hors bornes`).toBeGreaterThanOrEqual(0);
      expect(hint.score,    `${code}.score hors bornes`).toBeLessThanOrEqual(100);
      expect(hint.security, `${code}.security hors bornes`).toBeGreaterThanOrEqual(0);
      expect(hint.security, `${code}.security hors bornes`).toBeLessThanOrEqual(100);
      expect(hint.budget,   `${code}.budget hors bornes`).toBeGreaterThanOrEqual(0);
      expect(hint.budget,   `${code}.budget hors bornes`).toBeLessThanOrEqual(100);
    }
  });

  it("getHint ne retourne jamais le fallback neutre 55/55/55 pour un pays du catalogue", () => {
    const fallback = { score: 55, security: 55, budget: 55 };
    for (const code of catalogCodes) {
      const h = getHint(code);
      const isFallback = h.score === fallback.score && h.security === fallback.security && h.budget === fallback.budget;
      expect(isFallback, `${code} utilise le fallback neutre`).toBe(false);
    }
  });
});
