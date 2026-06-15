import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// COUNTRY-GUIDE-PDF-001 — export PDF du guide pays premium (déjà généré côté client).
// Style source-assertion (cohérent avec export-pdf.test.ts) + un smoke render réel.

function readSource(rel: string): string {
  return readFileSync(resolve(process.cwd(), rel), 'utf-8');
}

const ROUTE_PATH = 'app/api/export-pdf/[code]/route.ts';
const REPORT_PATH = 'lib/pdf/report.service.tsx';
const BTN_PATH = 'components/crisis/PdfExportButton.tsx';
const BLOCK_PATH = 'components/crisis/CountryGuideBlock.tsx';

// ── 1. report.service.tsx — branche de rendu countryGuide ─────────────────────

describe('TravelReport — mode countryGuide', () => {
  it('ReportProps accepte une prop countryGuide', () => {
    const src = readSource(REPORT_PATH);
    expect(src).toContain('countryGuide');
  });

  it('rend un titre « Guide pays premium »', () => {
    const src = readSource(REPORT_PATH);
    expect(src).toMatch(/GUIDE PAYS PREMIUM/i);
  });

  it('retire le markdown gras et découpe en paragraphes (réutilise le pattern existant)', () => {
    const src = readSource(REPORT_PATH);
    // La branche guide doit splitter sur les doubles sauts de ligne et strip les **.
    expect(src).toMatch(/guideText/);
  });
});

// ── 2. Route — mode export-only guide, AVANT le legacy C (pas de recalcul) ─────

describe('export-pdf route — countryGuide sans recalcul', () => {
  it('le schéma de payload accepte countryGuide', () => {
    const src = readSource(ROUTE_PATH);
    expect(src).toContain('countryGuide');
  });

  it('la branche countryGuide est AVANT la branche legacy (recalcul)', () => {
    const src = readSource(ROUTE_PATH);
    const guideIdx = src.indexOf('clientCountryGuide');
    const legacyIdx = src.indexOf('calculateCrisisScore');
    expect(guideIdx).toBeGreaterThan(-1);
    expect(legacyIdx).toBeGreaterThan(-1);
    // La consommation du guide doit apparaître avant l'import/usage du recalcul legacy.
    expect(guideIdx).toBeLessThan(legacyIdx);
  });

  it('ne relance PAS Perplexity (aucune référence à getPerplexityCountryFacts dans la route)', () => {
    const src = readSource(ROUTE_PATH);
    expect(src).not.toContain('getPerplexityCountryFacts');
  });

  it('conserve les modes existants A (itinerary) et B (scoreSnapshot)', () => {
    const src = readSource(ROUTE_PATH);
    expect(src).toContain('clientItinerary');
    expect(src).toContain('clientScoreSnapshot');
  });
});

// ── 3. PdfExportButton — slot countryGuide additif ────────────────────────────

describe('PdfExportButton — slot countryGuide', () => {
  it('accepte une prop countryGuide', () => {
    const src = readSource(BTN_PATH);
    expect(src).toContain('countryGuide');
  });

  it("envoie countryGuide dans le body quand fourni", () => {
    const src = readSource(BTN_PATH);
    expect(src).toMatch(/body\.countryGuide\s*=\s*countryGuide/);
  });
});

// ── 4. CountryGuideBlock — bouton PDF dans l'état succès ───────────────────────

describe('CountryGuideBlock — export PDF', () => {
  it('monte PdfExportButton avec le guide généré', () => {
    const src = readSource(BLOCK_PATH);
    expect(src).toContain('PdfExportButton');
    expect(src).toContain('countryGuide={guide}');
  });

  it("n'introduit aucun élément d'itinéraire (no-cards préservé)", () => {
    const src = readSource(BLOCK_PATH);
    expect(src).not.toContain('À planifier selon vos préférences');
    expect(src).not.toContain('DayCard');
    expect(src).not.toContain('afternoon');
  });
});

// ── 5. Smoke render réel — countryGuide produit un vrai PDF ────────────────────

describe('COUNTRY-GUIDE-PDF-001 — smoke render mode countryGuide', () => {
  it('renderToBuffer produit un PDF valide à partir d\'un countryGuide seul', async () => {
    const React = (await import('react')).default;
    const { renderToBuffer } = await import('@react-pdf/renderer');
    const { TravelReport } = await import('@/lib/pdf/report.service');

    const countryGuide = {
      countryCode: 'PT',
      countryName: 'Portugal',
      guideText:
        '**1. Vue d\'ensemble**\n\nLe Portugal est une destination accueillante.\n\n**8. Conseil final**\n\nProfite bien.',
      generatedAt: new Date().toISOString(),
    };

    const el = React.createElement(TravelReport, {
      countryGuide, countryName: 'Portugal', profile: {},
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const buf = await renderToBuffer(el as any);

    expect(buf.length).toBeGreaterThan(1000);
    expect(buf.subarray(0, 5).toString()).toBe('%PDF-');
  });
});
