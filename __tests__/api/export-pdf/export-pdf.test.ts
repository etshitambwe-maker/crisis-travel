import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

function readSource(rel: string): string {
  return readFileSync(resolve(process.cwd(), rel), 'utf-8');
}

const ROUTE_PATH   = 'app/api/export-pdf/[code]/route.ts';
const REPORT_PATH  = 'lib/pdf/report.service.tsx';
const BTN_PATH     = 'components/crisis/PdfExportButton.tsx';
const DEST_PATH    = 'app/destination/[country]/page.tsx';
// PREMIUM-FLOW-001F — l'export PDF de la page destination est désormais monté
// dans le bloc premium unifié, via le composant PremiumActions (et non plus
// directement dans page.tsx).
const ACTIONS_PATH = 'components/crisis/PremiumActions.tsx';

// ── 1. Route export-pdf ───────────────────────────────────────────────────────

describe('export-pdf route — structure et sécurité', () => {
  it('le fichier route existe', () => {
    expect(existsSync(resolve(process.cwd(), ROUTE_PATH))).toBe(true);
  });

  it('maxDuration = 60 est présent', () => {
    const src = readSource(ROUTE_PATH);
    expect(src).toContain('maxDuration = 60');
  });

  it('la route exporte une fonction POST (pas GET)', () => {
    const src = readSource(ROUTE_PATH);
    expect(src).toContain('export async function POST');
    // La route ne doit plus exporter GET (suppression du GET hardcodé)
    expect(src).not.toContain('export async function GET');
  });

  it('retourne 401 si non authentifié', () => {
    const src = readSource(ROUTE_PATH);
    expect(src).toContain("status: 401");
    expect(src).toContain('Authentification requise');
  });

  it('retourne 402 si non premium', () => {
    const src = readSource(ROUTE_PATH);
    expect(src).toContain("status: 402");
    expect(src).toContain('upgradeUrl');
    expect(src).toContain('/pricing');
  });

  it('getUserWithSubscription est appelé (gate premium)', () => {
    const src = readSource(ROUTE_PATH);
    expect(src).toContain('getUserWithSubscription');
    expect(src).toContain('isPremium');
  });

  it('le profil est construit depuis clientProfile avec fallback dans le mode legacy', () => {
    const src = readSource(ROUTE_PATH);
    // Les valeurs clientProfile sont utilisées dans les deux modes
    expect(src).toContain('clientProfile?.budget');
    expect(src).toContain('clientProfile?.duration');
    expect(src).toContain('clientProfile?.travelType');
    // Les fallbacks 1500/7/solo sont dans le bloc legacy (else), pas au niveau global
    expect(src).toContain('?? 1500');
    expect(src).toContain('?? 7');
  });

  it("l'itinéraire client est utilisé si fourni dans le payload", () => {
    const src = readSource(ROUTE_PATH);
    expect(src).toContain('clientItinerary');
    // Vérifie la présence de clientItinerary dans le payload TravelReport (indépendant de l'alignement)
    expect(src).toMatch(/itinerary:\s+clientItinerary/);
  });

  it("generateItinerary n'est pas importé dans la route PDF", () => {
    const src = readSource(ROUTE_PATH);
    expect(src).not.toContain('generateItinerary');
  });

  it("la route n'appelle pas /api/analyze", () => {
    const src = readSource(ROUTE_PATH);
    expect(src).not.toContain('/api/analyze');
  });

  it("la route ne modifie pas le quota gratuit", () => {
    const src = readSource(ROUTE_PATH);
    expect(src).not.toContain('checkAndIncrementQuota');
    expect(src).not.toContain('analysisQuota');
  });
});

// ── 1b. PDF-UX-004 — mode export-only quand itinerary fourni ─────────────────

describe('export-pdf route — mode export-only (PDF-UX-004)', () => {
  it('quand itinerary est fourni, calculateCrisisScore est dans un bloc conditionnel else isolé', () => {
    const src = readSource(ROUTE_PATH);
    // La branche export-only ne doit pas contenir calculateCrisisScore en chemin principal
    // On vérifie la structure : import dynamique de calculateCrisisScore dans le else uniquement
    expect(src).toContain('calculateCrisisScore');
    // L'import dynamique doit être dans le bloc else (legacy), pas au top-level
    expect(src).not.toMatch(/^import\s+\{[^}]*calculateCrisisScore/m);
    // L'import doit être dynamique (await import)
    expect(src).toMatch(/await import\(['"]\@\/lib\/services\/scoring\/crisisScore\.service['"]\)/);
  });

  it('quand itinerary est fourni, generateDestinationNarrative est dans le bloc else isolé', () => {
    const src = readSource(ROUTE_PATH);
    expect(src).toContain('generateDestinationNarrative');
    // Pas d'import statique top-level
    expect(src).not.toMatch(/^import\s+\{[^}]*generateDestinationNarrative/m);
    // Import dynamique dans le else
    expect(src).toMatch(/await import\(['"]\@\/lib\/claude\/claude\.service['"]\)/);
  });

  it('la bifurcation export-only vs legacy est explicite (if clientItinerary)', () => {
    const src = readSource(ROUTE_PATH);
    expect(src).toContain('if (clientItinerary)');
  });

  it("le mode export-only n'appelle pas calculateCrisisScore directement", () => {
    const src = readSource(ROUTE_PATH);
    // Les imports lourds doivent être dans le bloc legacy final (} else {),
    // après les deux blocs export-only (if clientItinerary / else if clientScoreSnapshot).
    const legacyElseIdx = src.lastIndexOf('} else {');
    const ifIdx         = src.indexOf('if (clientItinerary)');
    expect(ifIdx).toBeGreaterThan(-1);
    expect(legacyElseIdx).toBeGreaterThan(ifIdx);
    const crisisIdx = src.indexOf('calculateCrisisScore');
    expect(crisisIdx).toBeGreaterThan(legacyElseIdx);
  });

  it("le mode export-only n'appelle pas generateDestinationNarrative directement", () => {
    const src = readSource(ROUTE_PATH);
    const legacyElseIdx = src.lastIndexOf('} else {');
    const narrativeIdx  = src.indexOf('generateDestinationNarrative');
    expect(narrativeIdx).toBeGreaterThan(legacyElseIdx);
  });

  it('TravelReport reçoit itinerary clientItinerary dans le mode export-only', () => {
    const src = readSource(ROUTE_PATH);
    // Vérifie la présence de clientItinerary passé à TravelReport (indépendant de l'alignement)
    expect(src).toMatch(/itinerary:\s+clientItinerary/);
  });

  it('le mode export-only passe countryName à TravelReport', () => {
    const src = readSource(ROUTE_PATH);
    expect(src).toContain('countryName: country.name');
  });

  it('les appels lourds legacy restent dans le else final — fallback conservateur documenté', () => {
    const src = readSource(ROUTE_PATH);
    // Fallbacks 1500€/7j/solo uniquement dans le bloc legacy final
    const legacyElseIdx = src.lastIndexOf('} else {');
    const budget1500Idx = src.indexOf('?? 1500');
    const duration7Idx  = src.indexOf('?? 7');
    expect(budget1500Idx).toBeGreaterThan(legacyElseIdx);
    expect(duration7Idx).toBeGreaterThan(legacyElseIdx);
  });

  it('TravelReport accepte score optionnel dans report.service', () => {
    const src = readSource(REPORT_PATH);
    expect(src).toMatch(/score\?:\s*CrisisScore/);
  });

  it('TravelReport accepte narrative optionnel dans report.service', () => {
    const src = readSource(REPORT_PATH);
    expect(src).toMatch(/narrative\?:\s*string/);
  });

  it('TravelReport accepte countryName dans report.service', () => {
    const src = readSource(REPORT_PATH);
    expect(src).toContain('countryName?:');
  });

  it('le rendu narrative est conditionnel ({narrative && ...})', () => {
    const src = readSource(REPORT_PATH);
    expect(src).toMatch(/\{narrative &&/);
  });

  it('le rendu sous-scores est conditionnel (subScores.length > 0)', () => {
    const src = readSource(REPORT_PATH);
    expect(src).toMatch(/subScores\.length > 0/);
  });
});

// ── 1c. PDF-UX-005 — mode export-only destination report (scoreSnapshot) ──────

describe('export-pdf route — mode export-only destination report (PDF-UX-005)', () => {
  it('la route accepte scoreSnapshot dans le payload schema', () => {
    const src = readSource(ROUTE_PATH);
    expect(src).toContain('scoreSnapshotSchema');
    expect(src).toContain('scoreSnapshot:');
  });

  it('la route accepte narrative dans le payload schema', () => {
    const src = readSource(ROUTE_PATH);
    expect(src).toMatch(/narrative:\s+z\.string\(\)\.optional\(\)/);
  });

  it('clientScoreSnapshot est extrait du payload parsé', () => {
    const src = readSource(ROUTE_PATH);
    expect(src).toContain('clientScoreSnapshot');
    expect(src).toContain('clientNarrative');
  });

  it('la bifurcation scoreSnapshot est explicite (else if clientScoreSnapshot)', () => {
    const src = readSource(ROUTE_PATH);
    expect(src).toContain('else if (clientScoreSnapshot)');
  });

  it('Mode B passe score: clientScoreSnapshot à TravelReport', () => {
    const src = readSource(ROUTE_PATH);
    expect(src).toContain('score:       clientScoreSnapshot');
  });

  it('Mode B passe narrative: clientNarrative à TravelReport', () => {
    const src = readSource(ROUTE_PATH);
    expect(src).toContain('narrative:   clientNarrative');
  });

  it("Mode B n'appelle pas calculateCrisisScore (avant le bloc legacy)", () => {
    const src = readSource(ROUTE_PATH);
    // Mode B (else if clientScoreSnapshot) est avant le bloc legacy (} else {)
    const modeB      = src.indexOf('else if (clientScoreSnapshot)');
    const legacyElse = src.lastIndexOf('} else {');
    expect(modeB).toBeGreaterThan(-1);
    expect(legacyElse).toBeGreaterThan(modeB);
    // calculateCrisisScore n'est qu'après legacyElse
    const crisisIdx = src.indexOf('calculateCrisisScore');
    expect(crisisIdx).toBeGreaterThan(legacyElse);
  });

  it("Mode B n'appelle pas generateDestinationNarrative", () => {
    const src = readSource(ROUTE_PATH);
    const legacyElse   = src.lastIndexOf('} else {');
    const narrativeIdx = src.indexOf('generateDestinationNarrative');
    expect(narrativeIdx).toBeGreaterThan(legacyElse);
  });

  it('PdfExportButton déclare la prop scoreSnapshot', () => {
    const src = readSource(BTN_PATH);
    expect(src).toContain('scoreSnapshot?:');
  });

  it('PdfExportButton déclare la prop narrative (string)', () => {
    const src = readSource(BTN_PATH);
    expect(src).toContain('narrative?:');
  });

  it('PdfExportButton importe CrisisScore', () => {
    const src = readSource(BTN_PATH);
    expect(src).toContain('CrisisScore');
  });

  it('PdfExportButton inclut scoreSnapshot dans le body si présent', () => {
    const src = readSource(BTN_PATH);
    expect(src).toContain('body.scoreSnapshot  = scoreSnapshot');
  });

  it('PdfExportButton inclut narrative dans le body si présent', () => {
    const src = readSource(BTN_PATH);
    expect(src).toContain('body.narrative      = narrative');
  });

  it('trois modes distincts documentés dans la route (Mode A / B / C)', () => {
    const src = readSource(ROUTE_PATH);
    expect(src).toContain('Mode A');
    expect(src).toContain('Mode B');
    expect(src).toContain('Mode C');
  });
});

// ── 2. Report service ─────────────────────────────────────────────────────────

describe('report.service — rendu PDF', () => {
  it('TravelReport est exporté', () => {
    const src = readSource(REPORT_PATH);
    expect(src).toContain('export function TravelReport');
  });

  it('TravelReport accepte la prop itinerary optionnelle', () => {
    const src = readSource(REPORT_PATH);
    expect(src).toContain('itinerary?: ItineraryResult');
  });

  it('TravelReport accepte la prop profile', () => {
    const src = readSource(REPORT_PATH);
    expect(src).toContain('profile?:');
  });

  it('safetyDisclaimer est rendu si itinerary fourni', () => {
    const src = readSource(REPORT_PATH);
    expect(src).toContain('safetyDisclaimer');
    // La section itinéraire est conditionnelle
    expect(src).toContain('{itinerary && (');
  });

  it('officialSourceReminder est rendu si itinerary fourni', () => {
    const src = readSource(REPORT_PATH);
    expect(src).toContain('officialSourceReminder');
  });

  it('pas de wording "securite garantie" / "live" / "temps reel"', () => {
    const src = readSource(REPORT_PATH);
    expect(src).not.toContain('sécurité garantie');
    expect(src).not.toContain('garantit la sécurité');
    expect(src).not.toContain('données live');
    expect(src).not.toContain('temps réel');
  });

  it('le wording indicatif est présent dans le disclaimer', () => {
    const src = readSource(REPORT_PATH);
    expect(src).toContain('indicatif');
  });

  it("ItineraryResult est importé depuis @/types/crisis.types", () => {
    const src = readSource(REPORT_PATH);
    expect(src).toContain('ItineraryResult');
    expect(src).toContain('@/types/crisis.types');
  });
});

// ── 3. PdfExportButton ────────────────────────────────────────────────────────

describe('PdfExportButton — composant client', () => {
  it('le fichier existe', () => {
    expect(existsSync(resolve(process.cwd(), BTN_PATH))).toBe(true);
  });

  it('déclare "use client"', () => {
    const src = readSource(BTN_PATH);
    expect(src.trimStart()).toMatch(/^['"]use client['"]/);
  });

  it('PdfExportButton est exporté', () => {
    const src = readSource(BTN_PATH);
    expect(src).toContain('export function PdfExportButton');
  });

  it('appelle POST /api/export-pdf', () => {
    const src = readSource(BTN_PATH);
    expect(src).toContain("method: 'POST'");
    expect(src).toContain('/api/export-pdf/');
  });

  it('data-testid présent sur le bouton', () => {
    const src = readSource(BTN_PATH);
    expect(src).toContain('data-testid="pdf-export-btn"');
  });

  it("n'appelle pas /api/analyze", () => {
    const src = readSource(BTN_PATH);
    expect(src).not.toContain('/api/analyze');
  });

  it("n'appelle pas generateItinerary", () => {
    const src = readSource(BTN_PATH);
    expect(src).not.toContain('generateItinerary');
  });
});

// ── 4. Intégration page destination ──────────────────────────────────────────

describe('destination page — intégration PdfExportButton (PDF-UX-005 / PREMIUM-FLOW-001F)', () => {
  it('PremiumActions est importé dans la page destination', () => {
    const src = readSource(DEST_PATH);
    expect(src).toContain("import { PremiumActions }");
  });

  it('PdfExportButton est monté dans PremiumActions (bloc premium unifié)', () => {
    const src = readSource(ACTIONS_PATH);
    expect(src).toContain('<PdfExportButton');
  });

  it("le lien <a href='/api/export-pdf/...'> est supprimé de la page", () => {
    const src = readSource(DEST_PATH);
    expect(src).not.toContain("href={`/api/export-pdf/");
  });

  it('la page passe scoreSnapshot={score} à PremiumActions (PDF-UX-005)', () => {
    const src = readSource(DEST_PATH);
    expect(src).toContain('scoreSnapshot={score}');
  });

  it('la page passe narrative={narrative} à PremiumActions (PDF-UX-005)', () => {
    const src = readSource(DEST_PATH);
    expect(src).toContain('narrative={narrative}');
  });

  it('score et narrative sont disponibles avant le rendu du bloc premium', () => {
    const src = readSource(DEST_PATH);
    // score et narrative sont déstructurés depuis result.data dans la page
    expect(src).toContain('const { score, narrative }');
  });

  it('PremiumActions ne monte jamais PdfExportButton sans scoreSnapshot', () => {
    const src = readSource(ACTIONS_PATH);
    // Le seul rendu de PdfExportButton doit recevoir scoreSnapshot.
    const btnOccurrences = src.split('<PdfExportButton').length - 1;
    const snapshotOccurrences = src.split('scoreSnapshot={scoreSnapshot}').length - 1;
    expect(btnOccurrences).toBeGreaterThan(0);
    expect(snapshotOccurrences).toBe(btnOccurrences);
  });

  it("calculateCrisisScore n'est pas appelé depuis PdfExportButton sur la page destination", () => {
    // PdfExportButton est un composant client — il ne doit pas importer calculateCrisisScore
    const src = readSource(BTN_PATH);
    expect(src).not.toContain('calculateCrisisScore');
  });

  it("generateDestinationNarrative n'est pas appelé depuis PdfExportButton", () => {
    const src = readSource(BTN_PATH);
    expect(src).not.toContain('generateDestinationNarrative');
  });
});

// ── 5. Non-régression fichiers critiques ─────────────────────────────────────

describe('non-régression PDF-UX-002 — fichiers non touchés', () => {
  const UNTOUCHED = [
    'app/api/itinerary/route.ts',
    'lib/claude/claude.service.ts',
    'lib/services/scoring/crisisScore.service.ts',
    'lib/auth/analysisQuota.ts',
    'app/api/analyze/route.ts',
  ];

  for (const f of UNTOUCHED) {
    it(`${f} n'importe pas PdfExportButton`, () => {
      const path = resolve(process.cwd(), f);
      if (!existsSync(path)) return;
      expect(readFileSync(path, 'utf-8')).not.toContain('PdfExportButton');
    });
  }

  it('generateItinerary non modifié — signature préservée', () => {
    const src = readSource('lib/claude/claude.service.ts');
    expect(src).toContain('export async function generateItinerary');
  });

  it('CANDIDATE_CAP absent des fichiers PDF', () => {
    expect(readSource(ROUTE_PATH)).not.toContain('CANDIDATE_CAP');
    expect(readSource(REPORT_PATH)).not.toContain('CANDIDATE_CAP');
  });

  it('TARGET_COUNTRIES absent des fichiers PDF', () => {
    expect(readSource(ROUTE_PATH)).not.toContain('TARGET_COUNTRIES');
    expect(readSource(REPORT_PATH)).not.toContain('TARGET_COUNTRIES');
  });

  it('calculateCrisisScore non ajouté dans PdfExportButton', () => {
    expect(readSource(BTN_PATH)).not.toContain('calculateCrisisScore');
  });
});

// ── 6. Non-régression PDF-DEBUG-P0 — chargement @react-pdf/renderer en runtime ───
// Le bug : @react-pdf/renderer est ESM-only ; un require() synchrone casse son
// reconciler au runtime serveur ("Cannot read properties of undefined (reading 'S')")
// → 500 invisible aux tests Node. Le fix impose import statique ESM + nodejs runtime
// + externalisation bundler. Ces tests verrouillent ce contrat.

describe('PDF-DEBUG-P0 — contrat de chargement @react-pdf/renderer', () => {
  it("la route N'utilise PAS require('@react-pdf/renderer') (ESM-only → casse au runtime)", () => {
    const src = readSource(ROUTE_PATH);
    expect(src).not.toMatch(/require\(\s*['"]@react-pdf\/renderer['"]\s*\)/);
  });

  it('la route importe renderToBuffer en import statique ESM', () => {
    const src = readSource(ROUTE_PATH);
    expect(src).toMatch(/import\s*\{\s*renderToBuffer\s*\}\s*from\s*['"]@react-pdf\/renderer['"]/);
  });

  it("la route déclare runtime = 'nodejs' (pas Edge — react-pdf nécessite Node)", () => {
    const src = readSource(ROUTE_PATH);
    expect(src).toMatch(/export\s+const\s+runtime\s*=\s*['"]nodejs['"]/);
  });

  it("la route n'utilise plus aucun appel require('...') interne (TravelReport/react inclus)", () => {
    const src = readSource(ROUTE_PATH);
    // Cible un vrai appel require('module') — pas la mention "require()" en commentaire.
    expect(src).not.toMatch(/require\(\s*['"]/);
  });

  it('next.config externalise @react-pdf/renderer du bundler serveur', () => {
    const cfg = readSource('next.config.ts');
    expect(cfg).toContain('serverExternalPackages');
    expect(cfg).toContain('@react-pdf/renderer');
  });
});

// ── 7. Smoke runtime — renderToBuffer(TravelReport) produit un vrai PDF ──────────
// Ce test exerce le rendu réel (ce qui manquait : les tests précédents lisaient le
// source mais ne rendaient jamais). Garantit que TravelReport reste rendable.

describe('PDF-DEBUG-P0 — smoke render Mode B', () => {
  it('renderToBuffer produit un PDF valide à partir d\'un scoreSnapshot', async () => {
    const React = (await import('react')).default;
    const { renderToBuffer } = await import('@react-pdf/renderer');
    const { TravelReport } = await import('@/lib/pdf/report.service');

    const score = {
      country: 'Japon', countryCode: 'JP', total: 82,
      security:     { value: 88, source: 'fallback' as const, confidence: 'medium' as const, details: { meaeLevel: 1 } },
      geopolitical: { value: 80, source: 'fallback' as const, confidence: 'medium' as const, details: { tension: 12 } },
      budget:       { value: 70, source: 'fallback' as const, confidence: 'medium' as const, details: { mealCheap: 8, hotelAvg: 60, currencyVariation: 3 } },
      practicality: { value: 75, source: 'fallback' as const, confidence: 'medium' as const, details: { visa: 'none' } },
      status: 'ideal' as const, confidence: 'medium' as const,
      calculatedAt: new Date().toISOString(),
    };

    const el = React.createElement(TravelReport, {
      score, narrative: 'Synthèse de test.', profile: {}, countryName: 'Japon',
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const buf = await renderToBuffer(el as any);

    expect(buf.length).toBeGreaterThan(1000);
    expect(buf.subarray(0, 5).toString()).toBe('%PDF-');
  });
});
