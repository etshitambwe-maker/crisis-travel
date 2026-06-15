import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const PATH = 'components/crisis/CountryGuideBlock.tsx';
function src(): string { return readFileSync(resolve(process.cwd(), PATH), 'utf-8'); }

describe('CountryGuideBlock — présence & structure', () => {
  it('le fichier existe', () => {
    expect(existsSync(resolve(process.cwd(), PATH))).toBe(true);
  });
  it('est un client component', () => {
    expect(src().trimStart()).toMatch(/^['"]use client['"]/);
  });
  it('exporte CountryGuideBlock', () => {
    expect(src()).toContain('export function CountryGuideBlock');
  });
  it('appelle /api/country-guide', () => {
    expect(src()).toContain('/api/country-guide');
  });
  it('a un bouton de génération (idle)', () => {
    expect(src()).toContain('data-testid="country-guide-generate-btn"');
  });
  it("gère l'état loading", () => {
    expect(src()).toMatch(/loading/);
  });
  it('rend le succès via NarrativeRenderer', () => {
    expect(src()).toContain('NarrativeRenderer');
    expect(src()).toContain('data-testid="country-guide-result"');
  });
  it("gère l'état fallback/échec avec Réessayer", () => {
    const s = src();
    expect(s).toContain('data-testid="country-guide-fallback"');
    expect(s.toLowerCase()).toContain('réessayer');
  });
  it('ne crashe pas si guideText absent (garde isFallback)', () => {
    expect(src()).toContain('isFallback');
  });
});

describe('CountryGuideBlock — invariants no-cards (non-régression)', () => {
  it('ne réintroduit AUCUNE carte jour/jour ni slot horaire', () => {
    const s = src();
    expect(s).not.toContain('À planifier selon vos préférences');
    expect(s).not.toMatch(/Jour\s*\{?\s*\d/);
    expect(s).not.toContain('morning');
    expect(s).not.toContain('afternoon');
    expect(s).not.toContain('evening');
    expect(s).not.toContain('DayCard');
  });
});
