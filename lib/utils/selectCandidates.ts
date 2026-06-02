import { getHint } from '@/lib/utils/staticHints';

/**
 * Pré-sélection des pays candidats AVANT le scoring complet (GOAL-031).
 *
 * Problème résolu : scorer les 66 pays cold-cache dépasse le plafond 60s de Vercel
 * (Perplinity ~8-9s/batch × 11 batchs). On réduit le workload en ne scorant que les
 * N meilleurs candidats d'après STATIC_HINTS (proxy statique, AUCUN appel réseau),
 * triés selon l'axe pertinent du mode. Le scoring réel (calculateCrisisScore) reste
 * inchangé : on change QUELS pays on score, pas COMMENT.
 *
 * Le mode continent n'est PAS concerné ici : il est déjà filtré en amont (volume OK)
 * et passe `cap = null` pour conserver tous ses pays.
 */

export type SelectMode = 'standard' | 'bunker' | 'budget_crisis';

export interface SelectableCountry {
  code: string;
}

/** Axe de tri statique selon le mode demandé. */
function hintAxis(mode: SelectMode, code: string): number {
  const h = getHint(code);
  if (mode === 'bunker') return h.security;       // sécurité maximale
  if (mode === 'budget_crisis') return h.budget;  // budget minimal
  return h.score;                                 // équilibre global
}

/**
 * Trie les pays par pertinence statique (mode) puis tronque à `cap` candidats.
 * @param countries  liste des pays candidats (déjà filtrés par continent si applicable)
 * @param mode       mode d'analyse — détermine l'axe de tri
 * @param cap        nombre max de pays à scorer ; `null` = pas de troncature (mode continent)
 */
export function selectCandidates<T extends SelectableCountry>(
  countries: T[],
  mode: SelectMode,
  cap: number | null,
): T[] {
  const sorted = [...countries].sort(
    (a, b) => hintAxis(mode, b.code) - hintAxis(mode, a.code),
  );
  if (cap === null || cap >= sorted.length) return sorted;
  return sorted.slice(0, cap);
}

/** Nombre de candidats scorés en mode non-continent (GOAL-031 : compromis ~27s cold < 60s). */
export const CANDIDATE_CAP = 18;
