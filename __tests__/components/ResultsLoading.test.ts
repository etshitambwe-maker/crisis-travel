import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// LOADING-UX-001 — le loader d'analyse doit être instantané, CSS-only (plus
// d'image lourde au rendu noir), accessible (role=status / aria-live) et le
// Suspense fallback de /results doit être cohérent plein écran (pas un texte pauvre).
// Style source-assertion : le repo teste les composants sans DOM (vitest env=node,
// pas de @testing-library) — cf. __tests__/components/ItineraryBlock.test.ts.

function read(rel: string): string {
  return readFileSync(resolve(process.cwd(), rel), 'utf-8');
}

const RESULTS_CONTENT = 'app/results/ResultsContent.tsx';
const RESULTS_PAGE = 'app/results/page.tsx';

describe('LOADING-UX-001 — overlay analyse CSS-only + accessible', () => {
  it('l\'overlay ne charge plus l\'image lourde analysis-loading-reference', () => {
    const src = read(RESULTS_CONTENT);
    expect(src).not.toContain('analysis-loading-reference');
  });

  it('le bloc loading ne contient plus de balise <img> (animation CSS pure)', () => {
    const src = read(RESULTS_CONTENT);
    // Isole le bloc rendu quand loading===true
    const start = src.indexOf('{loading && (');
    const end = src.indexOf('{/* ── Error state', start);
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const loadingBlock = src.slice(start, end);
    expect(loadingBlock).not.toMatch(/<img\b/);
  });

  it('l\'overlay porte role="status" et aria-live="polite"', () => {
    const src = read(RESULTS_CONTENT);
    const start = src.indexOf('{loading && (');
    const end = src.indexOf('{/* ── Error state', start);
    const loadingBlock = src.slice(start, end);
    expect(loadingBlock).toContain('role="status"');
    expect(loadingBlock).toContain('aria-live="polite"');
  });

  it('le message "Analyse en cours" reste présent dans le bloc loading', () => {
    const src = read(RESULTS_CONTENT);
    const start = src.indexOf('{loading && (');
    const end = src.indexOf('{/* ── Error state', start);
    const loadingBlock = src.slice(start, end);
    expect(loadingBlock).toContain('Analyse en cours');
  });

  it('le bloc loading conserve un garde prefers-reduced-motion', () => {
    const src = read(RESULTS_CONTENT);
    const start = src.indexOf('{loading && (');
    const end = src.indexOf('{/* ── Error state', start);
    const loadingBlock = src.slice(start, end);
    expect(loadingBlock).toContain('prefers-reduced-motion');
  });

  it('le bloc loading utilise une animation CSS (keyframes)', () => {
    const src = read(RESULTS_CONTENT);
    const start = src.indexOf('{loading && (');
    const end = src.indexOf('{/* ── Error state', start);
    const loadingBlock = src.slice(start, end);
    // Animation CSS référencée (keyframes ct0xx-…), en <style> et/ou en style inline.
    expect(loadingBlock).toMatch(/animation:\s*['"]?ct0\d\d-/);
  });
});

describe('LOADING-UX-001 — Suspense fallback /results cohérent plein écran', () => {
  it('page.tsx réutilise le loader plein écran (ResultsLoading) au lieu d\'un texte pauvre', () => {
    const src = read(RESULTS_PAGE);
    // Le fallback doit s'appuyer sur le composant loading.tsx existant.
    expect(src).toContain('ResultsLoading');
  });

  it('le fallback inline pauvre "Préparation de l\'analyse…" seul n\'est plus le fallback', () => {
    const src = read(RESULTS_PAGE);
    // On ne veut plus d'un fallback réduit à une ligne de texte sans surface 100vh.
    // Présence du composant plein écran => le texte pauvre inline est remplacé.
    const fallbackIdx = src.indexOf('fallback=');
    expect(fallbackIdx).toBeGreaterThan(-1);
    const fallbackChunk = src.slice(fallbackIdx, fallbackIdx + 200);
    expect(fallbackChunk).toContain('ResultsLoading');
  });
});

describe('LOADING-UX-001 — loader plein écran existant inchangé sur ses acquis', () => {
  it('results/loading.tsx couvre 100vh et respecte prefers-reduced-motion', () => {
    const src = read('app/results/loading.tsx');
    expect(src).toContain('100vh');
    expect(src).toContain('prefers-reduced-motion');
  });
});
