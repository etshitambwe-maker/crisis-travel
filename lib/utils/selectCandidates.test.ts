import { describe, it, expect } from 'vitest';
import { selectCandidates, CANDIDATE_CAP } from './selectCandidates';
import { TARGET_COUNTRIES } from './countries';
import { getHint } from './staticHints';

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

  it('ne mute pas le tableau d’entrée', () => {
    const input = [...ALL];
    const snapshot = input.map((c) => c.code);
    selectCandidates(input, 'bunker', CANDIDATE_CAP);
    expect(input.map((c) => c.code)).toEqual(snapshot);
  });

  it('cap >= longueur renvoie tous les pays triés (pas d’erreur de borne)', () => {
    const out = selectCandidates(ALL, 'standard', 9999);
    expect(out.length).toBe(ALL.length);
  });
});
