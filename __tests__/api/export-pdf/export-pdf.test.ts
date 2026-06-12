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

  it('le profil hardcodé est remplacé par les valeurs du payload', () => {
    const src = readSource(ROUTE_PATH);
    // Les valeurs doivent être issues de clientProfile avec fallback, pas fixées seules
    expect(src).toContain('clientProfile?.budget');
    expect(src).toContain('clientProfile?.duration');
    expect(src).toContain('clientProfile?.travelType');
    // Pas de valeurs hardcodées sans fallback dynamique
    const hardcodedLine = /budget:\s*1500[^,\n]*,\s*duration:\s*7[^,\n]*,\s*(?:period|travelType)/;
    expect(hardcodedLine.test(src)).toBe(false);
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
