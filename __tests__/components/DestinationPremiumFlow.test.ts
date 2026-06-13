import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// PREMIUM-FLOW-001D — Hiérarchie produit de la page /destination/[country].
//
//  - Une SYNTHÈSE GRATUITE de base est visible HORS PremiumGate.
//  - La SYNTHÈSE IA COMPLÈTE reste premium (approfondissement), dans PremiumGate.
//  - Un CTA "Préparer mon itinéraire" est VISIBLE et respecte 3 états :
//       non connecté → AuthModal ; connecté non premium → /pricing ; premium → /results.
//  - Aucun itinéraire n'est généré avec les valeurs figées (7j/1500€/solo).
//
// Style source-assertion (repo sans testing-library/jsdom — env node),
// cf. PremiumGate.test.ts / ItineraryBlock.test.ts / ResultsLoading.test.ts.

function read(rel: string): string {
  return readFileSync(resolve(process.cwd(), rel), 'utf-8');
}

const DEST_PAGE = 'app/destination/[country]/page.tsx';
const CTA = 'components/crisis/PrepareItineraryCta.tsx';

describe('PREMIUM-FLOW-001D — synthèse gratuite visible hors PremiumGate', () => {
  it('la page importe et utilise buildFreeSummary (synthèse construite côté serveur)', () => {
    const src = read(DEST_PAGE);
    expect(src).toMatch(/buildFreeSummary/);
  });

  it('rend une section "Synthèse" gratuite AVANT toute balise PremiumGate', () => {
    const src = read(DEST_PAGE);
    const freeIdx = src.indexOf('data-testid="free-summary"');
    const firstGateIdx = src.indexOf('<PremiumGate');
    expect(freeIdx).toBeGreaterThan(-1);
    expect(firstGateIdx).toBeGreaterThan(-1);
    // la synthèse gratuite est rendue avant le premier gate premium
    expect(freeIdx).toBeLessThan(firstGateIdx);
  });

  it('la synthèse gratuite n\'est PAS enveloppée par un PremiumGate', () => {
    const src = read(DEST_PAGE);
    const freeIdx = src.indexOf('data-testid="free-summary"');
    // Le PremiumGate ouvert le plus proche AVANT la synthèse gratuite ne doit pas
    // exister, OU doit avoir été refermé. On vérifie qu'entre le dernier
    // <PremiumGate ouvert avant freeIdx et freeIdx, il y a bien un </PremiumGate>.
    const before = src.slice(0, freeIdx);
    const lastOpen = before.lastIndexOf('<PremiumGate');
    if (lastOpen !== -1) {
      const closeBetween = src.slice(lastOpen, freeIdx).indexOf('</PremiumGate>');
      expect(closeBetween).toBeGreaterThan(-1);
    }
    // Cas nominal attendu : aucun PremiumGate avant la synthèse gratuite.
    expect(lastOpen).toBe(-1);
  });
});

describe('PREMIUM-FLOW-001D — synthèse IA complète reste premium (approfondissement)', () => {
  it('le bloc "Synthèse IA complète" reste enveloppé dans un PremiumGate', () => {
    const src = read(DEST_PAGE);
    const idx = src.indexOf('feature="Synthèse IA complète"');
    expect(idx).toBeGreaterThan(-1);
    // un <PremiumGate l'ouvre
    const open = src.lastIndexOf('<PremiumGate', idx);
    expect(open).toBeGreaterThan(-1);
  });

  it('la synthèse premium est présentée comme un APPROFONDISSEMENT (wording explicite)', () => {
    const src = read(DEST_PAGE);
    expect(src).toMatch(/approfondi|approfondissement|analyse détaillée|détaillée/i);
  });
});

describe('PREMIUM-FLOW-001D — CTA "Préparer mon itinéraire" visible + 3 états', () => {
  it('le composant CTA existe', () => {
    const src = read(CTA);
    expect(src).toMatch(/Préparer mon itinéraire/);
  });

  it('la page destination monte le CTA "Préparer mon itinéraire"', () => {
    const src = read(DEST_PAGE);
    expect(src).toMatch(/PrepareItineraryCta/);
  });

  it('CTA — non connecté → ouvre AuthModal', () => {
    const src = read(CTA);
    expect(src).toContain('<AuthModal');
    expect(src).toMatch(/setShowAuth\(true\)/);
  });

  it('CTA — connecté non premium → /pricing', () => {
    const src = read(CTA);
    expect(src).toContain('/pricing');
  });

  it('CTA — premium → redirige vers /results', () => {
    const src = read(CTA);
    expect(src).toContain('/results');
  });

  it('CTA — la décision dépend de isLoggedIn ET isPremium (3 états distincts)', () => {
    const src = read(CTA);
    expect(src).toMatch(/isPremium/);
    expect(src).toMatch(/isLoggedIn/);
  });
});

describe('PREMIUM-FLOW-001D — aucun itinéraire généré avec valeurs figées', () => {
  it('la page ne monte PAS ItineraryBlock (pas de génération in-place avec profil figé)', () => {
    const src = read(DEST_PAGE);
    expect(src).not.toMatch(/<ItineraryBlock/);
  });

  it('le CTA ne construit pas de requête itinéraire avec budget/duration codés en dur', () => {
    const src = read(CTA);
    // Le CTA redirige seulement — il n'appelle pas /api/itinerary.
    expect(src).not.toMatch(/\/api\/itinerary/);
  });
});

describe('PREMIUM-FLOW-001D — non-régression export PDF', () => {
  it('le gate "Export PDF" reste en variant card', () => {
    const src = read(DEST_PAGE);
    const idx = src.indexOf('feature="Export PDF"');
    expect(idx).toBeGreaterThan(-1);
    const gateOpen = src.slice(src.lastIndexOf('<PremiumGate', idx), idx + 400);
    expect(gateOpen).toContain('variant="card"');
  });
});
