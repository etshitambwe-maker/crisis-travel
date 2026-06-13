import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// PREMIUM-FLOW-001D/E/F — Hiérarchie produit de /destination/[country].
//
//  001D/E — La SYNTHÈSE GRATUITE de base est visible HORS PremiumGate (section 06).
//  001F   — Le premium est regroupé en UN SEUL bloc « Aller plus loin avec Premium »
//           (section 07) :
//             * non-premium → un seul PremiumGate (variant card) avec les bénéfices
//               listés UNE seule fois et un seul CTA d'état
//               (non connecté → AuthModal ; connecté non premium → /pricing) ;
//             * premium → la narrative complète visible immédiatement, suivie de
//               DEUX actions réelles (PremiumActions : itinéraire → /results + PDF).
//           Plus de trio (gate Synthèse IA + PrepareItineraryCta + gate Export PDF)
//           qui répétait les mêmes promesses.
//  001F   — Aucun itinéraire généré in-place avec des valeurs figées (7j/1500€/solo).
//
// Style source-assertion (repo sans testing-library/jsdom — env node),
// cf. PremiumGate.test.ts / ItineraryBlock.test.ts / ResultsLoading.test.ts.

function read(rel: string): string {
  return readFileSync(resolve(process.cwd(), rel), 'utf-8');
}

const DEST_PAGE = 'app/destination/[country]/page.tsx';
const ACTIONS = 'components/crisis/PremiumActions.tsx';

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
    const before = src.slice(0, freeIdx);
    const lastOpen = before.lastIndexOf('<PremiumGate');
    // Cas nominal attendu : aucun PremiumGate avant la synthèse gratuite.
    expect(lastOpen).toBe(-1);
  });
});

// ── PREMIUM-FLOW-001E — le PARAGRAPHE de synthèse basique est rendu dans la page ─
describe('PREMIUM-FLOW-001E — paragraphe de synthèse basique affiché', () => {
  it('la page rend freeSummary.basicSynthesis (vrai paragraphe, pas seulement le verdict)', () => {
    const src = read(DEST_PAGE);
    expect(src).toMatch(/freeSummary\.basicSynthesis/);
  });

  it('le paragraphe basicSynthesis est rendu DANS le bloc free-summary (hors gate)', () => {
    const src = read(DEST_PAGE);
    const freeIdx = src.indexOf('data-testid="free-summary"');
    const paraIdx = src.indexOf('freeSummary.basicSynthesis');
    const firstGateIdx = src.indexOf('<PremiumGate');
    expect(paraIdx).toBeGreaterThan(freeIdx);
    expect(paraIdx).toBeLessThan(firstGateIdx);
  });

  it('la page passe le profil (travelType) à buildFreeSummary', () => {
    const src = read(DEST_PAGE);
    expect(src).toMatch(/buildFreeSummary\(\s*score\s*,\s*narrative\s*,/);
  });
});

// ── PREMIUM-FLOW-001F — un seul bloc premium unifié (section 07) ─────────────────
describe('PREMIUM-FLOW-001F — bloc premium unifié (anti-doublons)', () => {
  it('la page ne monte QU\'UN SEUL PremiumGate (plus de gate Export PDF séparé)', () => {
    const src = read(DEST_PAGE);
    const gateOpens = (src.match(/<PremiumGate/g) ?? []).length;
    expect(gateOpens).toBe(1);
  });

  it('le PremiumGate unifié porte le titre "Aller plus loin avec Premium"', () => {
    const src = read(DEST_PAGE);
    expect(src).toMatch(/feature="Aller plus loin avec Premium"/);
  });

  it('la page ne contient PLUS de gate dédié "Export PDF" (fusionné dans le bloc unique)', () => {
    const src = read(DEST_PAGE);
    expect(src).not.toContain('feature="Export PDF"');
  });

  it('la page ne monte PLUS le composant autonome PrepareItineraryCta (fusionné)', () => {
    const src = read(DEST_PAGE);
    expect(src).not.toMatch(/<PrepareItineraryCta/);
  });

  it('la liste des bénéfices premium n\'est rendue qu\'une fois (un seul PremiumGate)', () => {
    // La liste PREMIUM_BENEFITS vit dans le composant PremiumGate ; elle n'est donc
    // rendue qu'une fois puisqu'il n'y a qu'un seul <PremiumGate sur la page.
    const src = read(DEST_PAGE);
    const gateOpens = (src.match(/<PremiumGate/g) ?? []).length;
    expect(gateOpens).toBe(1);
    // La page ne ré-énumère PAS le triptyque de bénéfices en dur (anti-doublon) :
    // « PDF illimité » n'apparaît qu'au plus une fois, dans la description du gate.
    const pdfUnlimited = (src.match(/PDF illimité/g) ?? []).length;
    expect(pdfUnlimited).toBeLessThanOrEqual(1);
  });
});

describe('PREMIUM-FLOW-001D/F — synthèse IA complète + actions premium', () => {
  it('le contenu premium (narrative) reste protégé par le PremiumGate unifié', () => {
    const src = read(DEST_PAGE);
    const gateOpen = src.indexOf('<PremiumGate');
    const gateClose = src.indexOf('</PremiumGate>');
    expect(gateOpen).toBeGreaterThan(-1);
    expect(gateClose).toBeGreaterThan(gateOpen);
    const block = src.slice(gateOpen, gateClose);
    // La narrative premium est rendue à l'intérieur du gate.
    expect(block).toMatch(/narrative/);
  });

  it('la synthèse premium est présentée comme un APPROFONDISSEMENT (wording explicite)', () => {
    const src = read(DEST_PAGE);
    expect(src).toMatch(/approfondi|approfondissement|analyse détaillée|détaillée/i);
  });

  it('les deux actions premium (itinéraire + PDF) sont rendues via PremiumActions, dans le gate', () => {
    const src = read(DEST_PAGE);
    expect(src).toMatch(/PremiumActions/);
    const gateOpen = src.indexOf('<PremiumGate');
    const gateClose = src.indexOf('</PremiumGate>');
    const block = src.slice(gateOpen, gateClose);
    expect(block).toMatch(/<PremiumActions/);
  });
});

describe('PREMIUM-FLOW-001F — composant PremiumActions (actions premium réelles)', () => {
  it('expose un bouton "Préparer mon itinéraire"', () => {
    const src = read(ACTIONS);
    expect(src).toMatch(/Préparer mon itinéraire/);
  });

  it('le bouton itinéraire redirige vers /results (vrai flow, pas de génération in-place)', () => {
    const src = read(ACTIONS);
    expect(src).toContain('/results');
  });

  it('PremiumActions n\'appelle PAS de route itinéraire (aucune valeur figée)', () => {
    const src = read(ACTIONS);
    expect(src).not.toMatch(/\/api\/itinerary/);
  });

  it('PremiumActions monte PdfExportButton pour l\'export', () => {
    const src = read(ACTIONS);
    expect(src).toMatch(/PdfExportButton/);
  });
});

describe('PREMIUM-FLOW-001D — aucun itinéraire généré avec valeurs figées', () => {
  it('la page ne monte PAS ItineraryBlock (pas de génération in-place avec profil figé)', () => {
    const src = read(DEST_PAGE);
    expect(src).not.toMatch(/<ItineraryBlock/);
  });
});
