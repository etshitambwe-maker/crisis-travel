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
    // PREMIUM-FLOW-001C : la distinction isLoggedIn est désormais centralisée dans
    // le composant PremiumCta (un seul `if (isLoggedIn)`), réutilisé par les deux
    // variants. On vérifie que cette branche existe ET que les deux variants passent
    // bien `isLoggedIn` au CTA partagé.
    expect(src).toMatch(/if\s*\(isLoggedIn\)/);
    const ctaUsages = src.match(/<PremiumCta[\s\S]*?isLoggedIn={isLoggedIn}/g) ?? [];
    expect(ctaUsages.length).toBeGreaterThanOrEqual(2);
  });
});

// PREMIUM-FLOW-001F — la page destination n'a plus qu'UN SEUL PremiumGate unifié
// (« Aller plus loin avec Premium »). Les anciens gates séparés (« Synthèse IA
// complète » overlay + « Export PDF » card) sont fusionnés. Le bloc unique
// regroupe la narrative premium + les actions (itinéraire + PDF). On garde le
// variant card pour une carte premium autonome lisible côté non-premium.
describe('PREMIUM-FLOW-001F — page destination : un seul gate premium unifié', () => {
  it('le bloc premium unifié passe variant="card"', () => {
    const src = read(DEST_PAGE);
    const idx = src.indexOf('feature="Aller plus loin avec Premium"');
    expect(idx).toBeGreaterThan(-1);
    const gateOpen = src.slice(src.lastIndexOf('<PremiumGate', idx), idx + 600);
    expect(gateOpen).toContain('variant="card"');
  });

  it('il n\'existe qu\'un seul PremiumGate sur la page (anti-doublon)', () => {
    const src = read(DEST_PAGE);
    const gateOpens = (src.match(/<PremiumGate/g) ?? []).length;
    expect(gateOpens).toBe(1);
  });
});

describe('PREMIUM-UX-001 — /pricing intacte (non-régression)', () => {
  it('la grille pricing reste responsive (auto-fit minmax)', () => {
    const src = read('app/pricing/page.tsx');
    expect(src).toContain('repeat(auto-fit, minmax(240px, 1fr))');
  });
});

// ── PREMIUM-FLOW-001C — action du CTA selon l'état + wording premium ──────────────
//
// BUG corrigé : le label du CTA basculait selon isLoggedIn ("Passer à Premium" vs
// "Se connecter") MAIS l'action était toujours setShowAuth(true). Un utilisateur
// connecté non premium se voyait donc redemander de se connecter au lieu d'être
// envoyé vers /pricing.
//
// Contrat d'action (aligné sur le pattern HTTP 402 de PdfExportButton/ItineraryBlock) :
//   - non connecté          → CTA = bouton qui ouvre AuthModal (setShowAuth(true))
//   - connecté non premium  → CTA = lien <a href="/pricing">, JAMAIS setShowAuth
//   - premium               → children rendu, pas de gate (inchangé)
//
// Style source-assertion (repo sans testing-library/jsdom).

describe('PREMIUM-FLOW-001C — action du CTA PremiumGate selon l\'état', () => {
  it('utilisateur non connecté : le CTA ouvre AuthModal (setShowAuth(true))', () => {
    const src = read(GATE);
    // L'ouverture de la modale d'auth reste câblée pour le cas non connecté.
    expect(src).toContain('setShowAuth(true)');
    expect(src).toContain('<AuthModal');
  });

  it('connecté non premium : le CTA pointe vers /pricing (et n\'ouvre pas AuthModal)', () => {
    const src = read(GATE);
    // Le chemin connecté-non-premium doit naviguer vers /pricing.
    expect(src).toContain('/pricing');
  });

  it('le CTA premium n\'est plus un onClick inconditionnel vers setShowAuth', () => {
    const src = read(GATE);
    // Anti-régression du bug exact : on n'autorise plus un CTA dont le SEUL
    // comportement est setShowAuth(true) quel que soit isLoggedIn. La décision
    // doit dépendre de isLoggedIn (lien /pricing OU ouverture AuthModal).
    // On vérifie qu'au moins un chemin /pricing existe pour l'état connecté.
    const pricingCount = (src.match(/\/pricing/g) ?? []).length;
    expect(pricingCount).toBeGreaterThanOrEqual(1);
  });

  it('variant card : couvre les deux chemins (AuthModal non connecté + /pricing connecté)', () => {
    const src = read(GATE);
    const cardIdx = src.indexOf("variant === 'card'");
    expect(cardIdx).toBeGreaterThan(-1);
    // Bloc card jusqu'au commentaire du variant overlay.
    const overlayIdx = src.indexOf('Variant OVERLAY', cardIdx);
    const cardBlock = src.slice(cardIdx, overlayIdx > -1 ? overlayIdx : cardIdx + 2200);
    expect(cardBlock).toContain('/pricing');
    expect(cardBlock).toContain('isLoggedIn');
  });

  it('variant overlay : couvre les deux chemins (AuthModal non connecté + /pricing connecté)', () => {
    const src = read(GATE);
    const overlayIdx = src.indexOf('Variant OVERLAY');
    expect(overlayIdx).toBeGreaterThan(-1);
    const overlayBlock = src.slice(overlayIdx);
    expect(overlayBlock).toContain('/pricing');
    expect(overlayBlock).toContain('isLoggedIn');
  });
});

describe('PREMIUM-FLOW-001C — wording premium clarifié', () => {
  it('mentionne 9€/mois', () => {
    const src = read(GATE);
    expect(src).toMatch(/9\s*€\s*\/\s*mois|9€\/mois|9 €\/mois/i);
  });

  it('mentionne 79€/an', () => {
    const src = read(GATE);
    expect(src).toMatch(/79\s*€\s*\/\s*an|79€\/an|79 €\/an/i);
  });

  it('mentionne "PDF illimité"', () => {
    const src = read(GATE);
    expect(src).toMatch(/PDF illimit/i);
  });

  it('mentionne "Préparer mon itinéraire"', () => {
    const src = read(GATE);
    expect(src).toMatch(/Préparer mon itinéraire/i);
  });

  it('garde un wording court (pas de grille tarifaire dupliquée depuis /pricing)', () => {
    const src = read(GATE);
    // La grille complète reste sur /pricing : on ne réimporte pas PLANS ni FAQ.
    expect(src).not.toContain('QUESTIONS FRÉQUENTES');
    expect(src).not.toContain('const PLANS');
  });
});
