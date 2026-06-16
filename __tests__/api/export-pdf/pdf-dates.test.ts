import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const src = readFileSync(resolve(process.cwd(), 'lib/pdf/report.service.tsx'), 'utf-8');

describe('TRAVEL-DATES-001 — TravelReport affichage dates dans le header PDF', () => {
  it('référence profile?.from dans le rendu', () => {
    expect(src).toMatch(/profile\?\.from|profile\.from/);
  });

  it('référence profile?.to dans le rendu', () => {
    expect(src).toMatch(/profile\?\.to|profile\.to/);
  });

  it('le rendu est conditionnel (ne crashe pas si absent)', () => {
    // L'affichage des dates doit être gardé par une condition
    expect(src).toMatch(/profile\?\.from\s*\|\|\s*profile\?\.to|profile\.from\s*&&/);
  });

  it('utilise toLocaleDateString pour formater la date', () => {
    const datesBlock = src.slice(src.indexOf('TRAVEL-DATES-001'));
    expect(datesBlock).toContain('toLocaleDateString');
  });
});
