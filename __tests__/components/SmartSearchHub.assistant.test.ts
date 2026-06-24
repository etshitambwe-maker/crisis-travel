import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const src = readFileSync(
  resolve(process.cwd(), 'components/crisis/SmartSearchHub.tsx'),
  'utf-8',
);

describe('MOBILE-ASSISTANT-001 — invariants logique d\'analyse préservés', () => {
  it('construit toujours l\'URL /results avec les bons paramètres', () => {
    expect(src).toContain('/results?');
    expect(src).toMatch(/budget:\s*String/);
    expect(src).toMatch(/duration:\s*String/);
    expect(src).toContain('travelType');
    expect(src).toContain('priority');
    expect(src).toContain('airport');
  });

  it('conserve BUDGET_MAP et DURATION_MAP', () => {
    expect(src).toContain('BUDGET_MAP');
    expect(src).toContain('DURATION_MAP');
  });

  it('conserve le mapping priority → mode', () => {
    expect(src).toMatch(/securite'?\s*\?\s*'bunker'/);
    expect(src).toMatch(/budget'?\s*\?\s*'budget_crisis'/);
  });

  it('conserve les locks d\'analyse', () => {
    expect(src).toContain('acquireAnalyzeLock');
    expect(src).toContain('releaseAnalyzeLock');
  });

  it('conserve le calcul de durée depuis les dates', () => {
    expect(src).toMatch(/getTime\(\).*86400000|86400000/);
  });

  it('conserve le seuil minimum de 2 critères', () => {
    expect(src).toMatch(/completed\s*[<>]=?\s*2|>=\s*2/);
  });
});
