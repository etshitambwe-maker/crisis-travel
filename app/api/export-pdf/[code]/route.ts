import { NextResponse } from 'next/server';
import { z } from 'zod';
import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import { findCountry } from '@/lib/utils/countries';
import { getUserWithSubscription } from '@/lib/auth/supabase-server';
import { TravelReport } from '@/lib/pdf/report.service';
import type { CrisisScore, ItineraryResult, PremiumCountryGuide } from '@/types/crisis.types';

// PDF-UX-002: maxDuration augmenté à 60s — PDF + Claude narrative peut dépasser 10s (défaut Vercel Hobby).
export const maxDuration = 60;
// @react-pdf/renderer est ESM-only : un require() synchrone échoue ("reading 'S'"
// dans son reconciler) sous le bundler serveur. Import statique ESM + Node runtime
// le chargent correctement. (PDF-DEBUG-P0)
export const runtime = 'nodejs';

// ── Validation payload POST ───────────────────────────────────────────────────

const profileSchema = z.object({
  budget:     z.number().positive().max(1_000_000).optional(),
  duration:   z.number().int().min(1).max(365).optional(),
  travelType: z.enum(['solo', 'couple', 'family', 'nomad']).optional(),
  from:       z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to:         z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
}).optional();

// ItineraryResult accepté tel quel depuis le client — validation minimale de shape.
// GUIDE-V1 : l'itinéraire est désormais un TEXTE de guide (narrativeText). `days` devient
// optionnel (vide pour une génération guide-v1, encore présent pour d'anciens itinéraires).
// narrativeText DOIT être accepté ici, sinon Zod le strip et le PDF perdrait le texte guide.
const itinerarySchema = z.object({
  countryCode:   z.string(),
  countryName:   z.string(),
  durationDays:  z.number(),
  budget:        z.object({ amount: z.number(), currency: z.string(), level: z.string() }),
  narrativeText: z.string().optional(),
  days:          z.array(z.object({
    day:             z.number(),
    title:           z.string(),
    summary:         z.string(),
    morning:         z.string(),
    afternoon:       z.string(),
    evening:         z.string(),
    estimatedBudget: z.string(),
    safetyNote:      z.string(),
  })).optional().default([]),
  globalAdvice:           z.array(z.string()).optional().default([]),
  safetyDisclaimer:       z.string(),
  officialSourceReminder: z.string(),
  generatedAt:            z.string(),
  cityOrRegion:           z.string().optional(),
}).optional();

// CrisisScore snapshot — validation minimale des champs consommés par TravelReport.
const subScoreSchema = z.object({
  value:      z.number(),
  source:     z.enum(['live', 'fallback', 'partial']),
  confidence: z.enum(['high', 'medium', 'low']),
  details:    z.record(z.string(), z.union([z.number(), z.string()])),
});
const scoreSnapshotSchema = z.object({
  country:       z.string(),
  countryCode:   z.string(),
  total:         z.number(),
  security:      subScoreSchema,
  geopolitical:  subScoreSchema,
  budget:        subScoreSchema,
  practicality:  subScoreSchema,
  status:        z.enum(['ideal', 'recommended', 'possible', 'discouraged']),
  confidence:    z.enum(['high', 'medium', 'low']),
  calculatedAt:  z.string(),
  opportunities: z.array(z.string()).optional(),
}).optional();

// COUNTRY-GUIDE-PDF-001 — guide pays premium DÉJÀ généré côté client (export-only,
// aucun appel IA). Validation minimale de shape (le texte est rendu tel quel).
const countryGuideSchema = z.object({
  countryCode: z.string(),
  countryName: z.string(),
  guideText:   z.string(),
  generatedAt: z.string(),
  isFallback:  z.boolean().optional(),
}).optional();

const pdfPayloadSchema = z.object({
  profile:       profileSchema,
  itinerary:     itinerarySchema,
  scoreSnapshot: scoreSnapshotSchema,
  narrative:     z.string().optional(),
  countryGuide:  countryGuideSchema,
});

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
): Promise<NextResponse> {
  const startMs = Date.now();
  // Mis à jour progressivement pour catégoriser les erreurs dans le catch global.
  let stage = 'auth';
  let selectedMode: 'Guide' | 'A_itinerary' | 'B_scoreSnapshot' | 'C_legacy' | 'unknown' = 'unknown';

  const { code } = await params;

  // Auth + vérification Premium — même pattern que /api/itinerary (402 non-premium)
  const { user, isPremium } = await getUserWithSubscription();
  if (!user) {
    return NextResponse.json({ error: 'Authentification requise' }, { status: 401 });
  }
  if (!isPremium) {
    return NextResponse.json(
      { error: 'Export PDF disponible avec le plan Premium', upgradeUrl: '/pricing' },
      { status: 402 }
    );
  }

  const userId = user.id;

  stage = 'country_lookup';
  const country = findCountry(code.toUpperCase());
  if (!country) {
    return NextResponse.json({ error: 'Pays non trouvé' }, { status: 404 });
  }

  console.log('[API/export-pdf] début', { code, userId });

  stage = 'parse_payload';
  // Payload optionnel — si absent ou non-JSON, on utilise les fallbacks conservateurs.
  let clientProfile:       z.infer<typeof profileSchema>       = undefined;
  let clientItinerary:     ItineraryResult | undefined          = undefined;
  let clientScoreSnapshot: CrisisScore | undefined              = undefined;
  let clientNarrative:     string | undefined                   = undefined;
  let clientCountryGuide:  PremiumCountryGuide | undefined       = undefined;

  const contentType = request.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    let body: unknown;
    try { body = await request.json(); } catch { body = {}; }
    const parsed = pdfPayloadSchema.safeParse(body);
    if (parsed.success) {
      clientProfile       = parsed.data.profile;
      clientItinerary     = parsed.data.itinerary     as ItineraryResult | undefined;
      clientScoreSnapshot = parsed.data.scoreSnapshot as CrisisScore | undefined;
      clientNarrative     = parsed.data.narrative;
      clientCountryGuide  = parsed.data.countryGuide  as PremiumCountryGuide | undefined;
    } else {
      // Validation échouée — on log les chemins sans jamais exposer les valeurs.
      console.warn('[API/export-pdf] payload invalide — fallback Mode C', {
        code,
        userId,
        issueCount: parsed.error.issues.length,
        paths: parsed.error.issues.map((i) => i.path.join('.')),
        codes: parsed.error.issues.map((i) => i.code),
      });
      // Le comportement reste identique : toutes les variables client restent undefined
      // et la cascade tombera en Mode C (legacy). Le log rend ce chemin visible.
    }
  }

  try {
    stage = 'select_mode';
    const profile = {
      budget:     clientProfile?.budget,
      duration:   clientProfile?.duration,
      travelType: clientProfile?.travelType,
      from:       clientProfile?.from,
      to:         clientProfile?.to,
    };

    let pdfBuffer: Buffer;

    // TravelReport rend un <Document> @react-pdf, mais TS voit ReportProps et non
    // DocumentProps — le cast aligne le type sur ce qu'attend renderToBuffer.
    const renderReport = (props: Parameters<typeof TravelReport>[0]) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      renderToBuffer(React.createElement(TravelReport, props) as any);

    if (clientCountryGuide && clientCountryGuide.guideText && !clientCountryGuide.isFallback) {
      // ── Mode Guide — export-only guide pays (COUNTRY-GUIDE-PDF-001) ─────────
      // Guide DÉJÀ généré côté client → AUCUN appel Perplexity/Claude/scoring.
      // Placé en TÊTE de cascade : un guide explicite ne doit jamais tomber dans
      // le legacy (Mode C) qui, lui, recalcule.
      selectedMode = 'Guide';
      console.log('[API/export-pdf] mode sélectionné', {
        mode: selectedMode,
        code,
        countryCode: clientCountryGuide.countryCode,
        hasProfile: !!clientProfile,
        hasItinerary: false,
        hasScoreSnapshot: false,
        hasCountryGuide: true,
        countryGuideFallbackExcluded: false,
      });
      stage = 'mode_guide_render';
      pdfBuffer = await renderReport({
        countryGuide: clientCountryGuide,
        profile,
        countryName:  country.name,
      });
    } else if (clientItinerary) {
      // ── Mode A — export-only itinerary (PDF-UX-004) ────────────────────────
      // itinerary déjà généré → pas d'appel Claude/scoring.
      selectedMode = 'A_itinerary';
      console.log('[API/export-pdf] mode sélectionné', {
        mode: selectedMode,
        code,
        countryCode: clientItinerary.countryCode,
        hasProfile: !!clientProfile,
        hasItinerary: true,
        hasScoreSnapshot: false,
        hasCountryGuide: false,
      });
      stage = 'mode_a_render';
      pdfBuffer = await renderReport({
        profile,
        itinerary:   clientItinerary,
        countryName: country.name,
      });
    } else if (clientScoreSnapshot) {
      // ── Mode B — export-only destination report (PDF-UX-005) ───────────────
      // score déjà calculé SSR sur la page destination → pas d'appel Claude/scoring.
      selectedMode = 'B_scoreSnapshot';
      console.log('[API/export-pdf] mode sélectionné', {
        mode: selectedMode,
        code,
        countryCode: clientScoreSnapshot.countryCode,
        hasProfile: !!clientProfile,
        hasItinerary: false,
        hasScoreSnapshot: true,
        hasCountryGuide: !!clientCountryGuide,
        countryGuideFallbackExcluded: !!(clientCountryGuide?.isFallback),
      });
      stage = 'mode_b_render';
      pdfBuffer = await renderReport({
        score:       clientScoreSnapshot,
        narrative:   clientNarrative,
        profile,
        countryName: country.name,
      });
    } else {
      // ── Mode C — legacy fallback : aucune donnée client suffisante ──────────
      // Uniquement si ni itinerary ni scoreSnapshot ne sont fournis.
      // Imports dynamiques isolés pour ne pas alourdir les modes A et B.
      selectedMode = 'C_legacy';
      console.log('[API/export-pdf] mode sélectionné', {
        mode: selectedMode,
        code,
        countryCode: code.toUpperCase(),
        hasProfile: !!clientProfile,
        hasItinerary: false,
        hasScoreSnapshot: false,
        hasCountryGuide: !!clientCountryGuide,
        countryGuideFallbackExcluded: !!(clientCountryGuide?.isFallback),
      });

      stage = 'mode_c_scoring';
      const { calculateCrisisScore }         = await import('@/lib/services/scoring/crisisScore.service');
      const { generateDestinationNarrative } = await import('@/lib/claude/claude.service');

      const fullProfile = {
        departureCountry: 'FR',
        budget:     clientProfile?.budget     ?? 1500,
        duration:   clientProfile?.duration   ?? 7,
        period:     'flexible',
        travelType: clientProfile?.travelType ?? 'solo' as const,
        mode:       'standard' as const,
      };

      const score = await calculateCrisisScore(country, fullProfile);

      stage = 'mode_c_narrative';
      const narrative = await generateDestinationNarrative(score, fullProfile);

      stage = 'render_pdf';
      pdfBuffer = await renderReport({
        score,
        narrative,
        profile,
        itinerary:   undefined,
        countryName: country.name,
      });
    }

    const durationMs = Date.now() - startMs;
    console.log('[API/export-pdf] terminé', {
      mode: selectedMode,
      code,
      durationMs,
      success: true,
    });

    const filename = `crisis-travel-${country.name.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}.pdf`;
    const uint8 = new Uint8Array(pdfBuffer);

    return new NextResponse(uint8, {
      status: 200,
      headers: {
        'Content-Type':        'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control':       'no-store',
      },
    });
  } catch (error) {
    const durationMs = Date.now() - startMs;
    const errName    = error instanceof Error ? error.name    : 'UnknownError';
    const errMessage = error instanceof Error ? error.message : String(error);
    console.error('[API/export-pdf] erreur', {
      stage,
      mode: selectedMode,
      code,
      durationMs,
      errorName: errName,
      errorMessage: errMessage,
    });
    return NextResponse.json({ error: 'Erreur génération PDF' }, { status: 500 });
  }
}
