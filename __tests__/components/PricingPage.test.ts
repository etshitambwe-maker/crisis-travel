import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// PREMIUM-CONVERSION-001 — /pricing doit lister uniquement des features réellement
// livrées et mettre en avant les nouveautés premium (guide pays, itinéraire, analyse).
// Style source-assertion (vitest env=node, pas de jsdom), même pattern que PremiumGate.test.ts.

function read(rel: string): string {
  return readFileSync(resolve(process.cwd(), rel), 'utf-8');
}

const PRICING = 'app/pricing/page.tsx';

describe('PREMIUM-CONVERSION-001 — /pricing features réelles', () => {
  it('mentionne le Guide terrain pays dans les features premium', () => {
    const src = read(PRICING);
    expect(src).toMatch(/Guide terrain pays/i);
  });

  it("mentionne l'itinéraire parcours-guide dans les features premium", () => {
    const src = read(PRICING);
    expect(src).toMatch(/[Ii]tinéraire.*parcours|parcours.*guide/i);
  });

  it("mentionne l'analyse détaillée ou risques/événements live", () => {
    const src = read(PRICING);
    expect(src).toMatch(/[Aa]nalyse détaillée|risques.*live|live.*risques/i);
  });

  it('mentionne les exports PDF (rapport + guide)', () => {
    const src = read(PRICING);
    expect(src).toMatch(/export.*pdf|pdf.*export/i);
  });

  it('ne mentionne PAS "Alertes push par email" (vaporware retiré)', () => {
    const src = read(PRICING);
    expect(src).not.toContain('Alertes push par email');
  });

  it('ne mentionne PAS "Tri et filtres avancés" (vaporware retiré)', () => {
    const src = read(PRICING);
    expect(src).not.toContain('Tri et filtres avancés');
  });

  it('ne mentionne PAS "Support prioritaire" (promesse marketing non livrée)', () => {
    const src = read(PRICING);
    expect(src).not.toContain('Support prioritaire');
  });

  it("liste l'historique des scores (livré via ScoreHistory)", () => {
    const src = read(PRICING);
    expect(src).toMatch(/historique.*scores?|scores?.*historique/i);
  });

  it('garde 3 plans : gratuit, premium mensuel, premium annuel', () => {
    const src = read(PRICING);
    expect(src).toContain("id: 'free'");
    expect(src).toContain("id: 'premium_monthly'");
    expect(src).toContain("id: 'premium_annual'");
  });
});
