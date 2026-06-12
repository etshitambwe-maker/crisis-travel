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
    expect(src).toContain('itinerary: clientItinerary');
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
    // Dans le bloc if(clientItinerary), renderToBuffer est appelé sans calculateCrisisScore
    // On vérifie que les deux imports lourds sont strictement dans le else
    const elseIdx = src.indexOf('} else {');
    const ifIdx   = src.indexOf('if (clientItinerary)');
    expect(ifIdx).toBeGreaterThan(-1);
    expect(elseIdx).toBeGreaterThan(ifIdx);
    // calculateCrisisScore n'apparaît qu'après le else
    const crisisIdx = src.indexOf('calculateCrisisScore');
    expect(crisisIdx).toBeGreaterThan(elseIdx);
  });

  it("le mode export-only n'appelle pas generateDestinationNarrative directement", () => {
    const src = readSource(ROUTE_PATH);
    const elseIdx     = src.indexOf('} else {');
    const narrativeIdx = src.indexOf('generateDestinationNarrative');
    expect(narrativeIdx).toBeGreaterThan(elseIdx);
  });

  it('TravelReport reçoit itinerary: clientItinerary dans le mode export-only', () => {
    const src = readSource(ROUTE_PATH);
    // Dans le bloc if(clientItinerary), on passe itinerary: clientItinerary à TravelReport
    expect(src).toContain('itinerary: clientItinerary');
  });

  it('le mode export-only passe countryName à TravelReport', () => {
    const src = readSource(ROUTE_PATH);
    expect(src).toContain('countryName: country.name');
  });

  it('les appels lourds legacy restent dans le else — fallback conservateur documenté', () => {
    const src = readSource(ROUTE_PATH);
    // Fallbacks 1500€/7j/solo uniquement dans le bloc else (legacy)
    const elseIdx = src.indexOf('} else {');
    const budget1500Idx = src.indexOf('?? 1500');
    const duration7Idx  = src.indexOf('?? 7');
    expect(budget1500Idx).toBeGreaterThan(elseIdx);
    expect(duration7Idx).toBeGreaterThan(elseIdx);
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

describe('destination page — intégration PdfExportButton', () => {
  it('PdfExportButton est importé', () => {
    const src = readSource(DEST_PATH);
    expect(src).toContain("import { PdfExportButton }");
  });

  it('PdfExportButton est rendu dans la PremiumGate', () => {
    const src = readSource(DEST_PATH);
    expect(src).toContain('<PdfExportButton');
  });

  it("le lien <a href='/api/export-pdf/...'> est supprimé", () => {
    const src = readSource(DEST_PATH);
    expect(src).not.toContain("href={`/api/export-pdf/");
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
