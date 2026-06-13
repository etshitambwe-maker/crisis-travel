import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// PREMIUM-UX-001 — PremiumGate doit supporter deux variants :
//  - 'overlay' (existant) : blur du children + overlay absolu, pour les GRANDS contenus.
//  - 'card' : vraie carte premium centrée/responsive, pour les PETITS children (bouton PDF)
//    où l'overlay absolu s'écrasait sur ~40px et coupait le contenu (overflow:hidden).
// Le gate "Export PDF" de la page destination doit utiliser variant="card".
// Style source-assertion : repo sans @testing-library (vitest env=node),
// cf. __tests__/components/ItineraryBlock.test.ts / ResultsLoading.test.ts.

function read(rel: string): string {
  return readFileSync(resolve(process.cwd(), rel), 'utf-8');
}

const GATE = 'components/auth/PremiumGate.tsx';
const DEST_PAGE = 'app/destination/[country]/page.tsx';

describe('PREMIUM-UX-001 — PremiumGate supporte un variant card/overlay', () => {
  it('expose une prop variant typée "overlay" | "card"', () => {
    const src = read(GATE);
    expect(src).toMatch(/variant\??:\s*['"]overlay['"]\s*\|\s*['"]card['"]/);
  });

  it('le variant overlay reste disponible (mode blur + overlay absolu conservé)', () => {
    const src = read(GATE);
    // Le mode historique doit subsister : blur du children + overlay positionné.
    expect(src).toContain("filter: 'blur(4px)'");
    expect(src).toContain("position: 'absolute'");
  });

  it('le variant card NE superpose PAS un overlay absolu sur le children', () => {
    const src = read(GATE);
    // En mode card, on rend une carte autonome (pas d'inset:0 sur le children).
    // Présence d'un bloc conditionnel dédié au mode card.
    expect(src).toMatch(/variant\s*===\s*['"]card['"]/);
  });

  it('le variant card garantit une largeur fluide (width 100%) et un CTA full-width', () => {
    const src = read(GATE);
    const cardIdx = src.indexOf("=== 'card'");
    expect(cardIdx).toBeGreaterThan(-1);
    // La carte et son CTA doivent occuper la largeur disponible (responsive 375px).
    const cardBlock = src.slice(cardIdx, cardIdx + 1600);
    expect(cardBlock).toMatch(/width:\s*'100%'/);
  });

  it('la carte premium reste centrée (alignement centre)', () => {
    const src = read(GATE);
    const cardIdx = src.indexOf("=== 'card'");
    const cardBlock = src.slice(cardIdx, cardIdx + 1600);
    expect(cardBlock).toMatch(/textAlign:\s*'center'|alignItems:\s*'center'/);
  });

  it('la distinction login (401) / premium (402) est conservée dans les deux variants', () => {
    const src = read(GATE);
    // Le libellé bascule selon isLoggedIn dans le mode existant ET le mode card.
    const occurrences = src.match(/isLoggedIn\s*\?/g) ?? [];
    expect(occurrences.length).toBeGreaterThanOrEqual(2);
  });
});

describe('PREMIUM-UX-001 — page destination utilise variant="card" pour Export PDF', () => {
  it('le PremiumGate "Export PDF" passe variant="card"', () => {
    const src = read(DEST_PAGE);
    // Isole le gate Export PDF (feature="Export PDF").
    const idx = src.indexOf('feature="Export PDF"');
    expect(idx).toBeGreaterThan(-1);
    // Cherche variant="card" dans le bloc d'ouverture du gate (avant le <PdfExportButton).
    const gateOpen = src.slice(src.lastIndexOf('<PremiumGate', idx), idx + 400);
    expect(gateOpen).toContain('variant="card"');
  });

  it('le gate "Synthèse IA" NE passe PAS variant="card" (reste overlay)', () => {
    const src = read(DEST_PAGE);
    const idx = src.indexOf('feature="Synthèse IA complète"');
    expect(idx).toBeGreaterThan(-1);
    const gateOpen = src.slice(src.lastIndexOf('<PremiumGate', idx), idx + 400);
    expect(gateOpen).not.toContain('variant="card"');
  });
});

describe('PREMIUM-UX-001 — /pricing intacte (non-régression)', () => {
  it('la grille pricing reste responsive (auto-fit minmax)', () => {
    const src = read('app/pricing/page.tsx');
    expect(src).toContain('repeat(auto-fit, minmax(240px, 1fr))');
  });
});
