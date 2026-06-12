import { NextResponse } from 'next/server';
import { z } from 'zod';
import { findCountry } from '@/lib/utils/countries';
import { getUserWithSubscription } from '@/lib/auth/supabase-server';
import type { CrisisScore, ItineraryResult } from '@/types/crisis.types';

// PDF-UX-002: maxDuration augmenté à 60s — PDF + Claude narrative peut dépasser 10s (défaut Vercel Hobby).
export const maxDuration = 60;

// ── Validation payload POST ───────────────────────────────────────────────────

const profileSchema = z.object({
  budget:     z.number().positive().max(1_000_000).optional(),
  duration:   z.number().int().min(1).max(365).optional(),
  travelType: z.enum(['solo', 'couple', 'family', 'nomad']).optional(),
  from:       z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to:         z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
}).optional();

// ItineraryResult accepté tel quel depuis le client — validation minimale de shape.
const itinerarySchema = z.object({
  countryCode:   z.string(),
  countryName:   z.string(),
  durationDays:  z.number(),
  budget:        z.object({ amount: z.number(), currency: z.string(), level: z.string() }),
  days:          z.array(z.object({
    day:             z.number(),
    title:           z.string(),
    summary:         z.string(),
    morning:         z.string(),
    afternoon:       z.string(),
    evening:         z.string(),
    estimatedBudget: z.string(),
    safetyNote:      z.string(),
  })),
  globalAdvice:           z.array(z.string()),
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

const pdfPayloadSchema = z.object({
  profile:       profileSchema,
  itinerary:     itinerarySchema,
  scoreSnapshot: scoreSnapshotSchema,
  narrative:     z.string().optional(),
});

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
): Promise<NextResponse> {
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

  const country = findCountry(code.toUpperCase());
  if (!country) {
    return NextResponse.json({ error: 'Pays non trouvé' }, { status: 404 });
  }

  // Payload optionnel — si absent ou non-JSON, on utilise les fallbacks conservateurs.
  let clientProfile:       z.infer<typeof profileSchema>       = undefined;
  let clientItinerary:     ItineraryResult | undefined          = undefined;
  let clientScoreSnapshot: CrisisScore | undefined              = undefined;
  let clientNarrative:     string | undefined                   = undefined;

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
    }
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { renderToBuffer } = require('@react-pdf/renderer') as { renderToBuffer: (el: unknown) => Promise<Buffer> };
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const React = require('react');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { TravelReport } = require('@/lib/pdf/report.service');

    const profile = {
      budget:     clientProfile?.budget,
      duration:   clientProfile?.duration,
      travelType: clientProfile?.travelType,
      from:       clientProfile?.from,
      to:         clientProfile?.to,
    };

    let pdfBuffer: Buffer;

    if (clientItinerary) {
      // ── Mode A — export-only itinerary (PDF-UX-004) ────────────────────────
      // itinerary déjà généré → pas d'appel Claude/scoring.
      pdfBuffer = await renderToBuffer(
        React.createElement(TravelReport, {
          profile,
          itinerary:   clientItinerary,
          countryName: country.name,
        })
      );
    } else if (clientScoreSnapshot) {
      // ── Mode B — export-only destination report (PDF-UX-005) ───────────────
      // score déjà calculé SSR sur la page destination → pas d'appel Claude/scoring.
      pdfBuffer = await renderToBuffer(
        React.createElement(TravelReport, {
          score:       clientScoreSnapshot,
          narrative:   clientNarrative,
          profile,
          countryName: country.name,
        })
      );
    } else {
      // ── Mode C — legacy fallback : aucune donnée client suffisante ──────────
      // Uniquement si ni itinerary ni scoreSnapshot ne sont fournis.
      // Imports dynamiques isolés pour ne pas alourdir les modes A et B.
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

      const score     = await calculateCrisisScore(country, fullProfile);
      const narrative = await generateDestinationNarrative(score, fullProfile);

      pdfBuffer = await renderToBuffer(
        React.createElement(TravelReport, {
          score,
          narrative,
          profile,
          itinerary:   undefined,
          countryName: country.name,
        })
      );
    }

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
    console.error('[API/export-pdf]', error);
    return NextResponse.json({ error: 'Erreur génération PDF' }, { status: 500 });
  }
}
