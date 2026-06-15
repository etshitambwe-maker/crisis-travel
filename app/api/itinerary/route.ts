import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getUserWithSubscription } from '@/lib/auth/supabase-server';
import { generateItinerary } from '@/lib/claude/claude.service';
import type { ItineraryApiResponse } from '@/types/crisis.types';

export const maxDuration = 60;

// ── Validation ───────────────────────────────────────────────────────────────

const ALLOWED_PREFERENCES = [
  'culture', 'food', 'nature', 'adventure', 'beach', 'city', 'history',
  'architecture', 'nightlife', 'family', 'slow travel', 'budget', 'luxury',
  'hiking', 'photography', 'wellness', 'sports', 'shopping', 'art', 'music',
] as const;

const itinerarySchema = z.object({
  countryCode: z.string().min(2).max(3).toUpperCase().optional(),
  countryName: z.string().min(1).max(100).optional(),
  cityOrRegion: z.string().min(1).max(100).optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format attendu : YYYY-MM-DD').optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format attendu : YYYY-MM-DD').optional(),
  duration: z.number().int().min(1).max(365).optional(),
  budget: z.number().positive('Le budget doit être positif').max(1_000_000).optional(),
  currency: z.string().min(3).max(3).toUpperCase().default('EUR'),
  travelers: z.number().int().min(1, 'travelers doit être >= 1').max(20).optional(),
  travelType: z.enum(['solo', 'couple', 'family', 'nomad']).optional(),
  preferences: z.array(
    z.string().refine(
      (p) => (ALLOWED_PREFERENCES as readonly string[]).includes(p.toLowerCase()),
      { message: 'Préférence non reconnue' }
    )
  ).max(10).optional(),
  riskContext: z.object({
    meaeLevel: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
    source: z.enum(['static', 'live']),
    lastUpdated: z.string().optional(),
  }).optional(),
}).refine(
  (d) => d.countryCode !== undefined || d.countryName !== undefined,
  { message: 'countryCode ou countryName est requis' }
).refine(
  (d) => {
    if (!d.from || !d.to) return true;
    return new Date(d.to) > new Date(d.from);
  },
  { message: 'La date de retour doit être après la date de départ', path: ['to'] }
);

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request: Request): Promise<NextResponse> {
  // 1. Auth check
  const { user, isPremium } = await getUserWithSubscription();
  if (!user) {
    return NextResponse.json(
      { error: 'Authentification requise' },
      { status: 401 }
    );
  }
  if (!isPremium) {
    return NextResponse.json(
      { error: 'Génération d\'itinéraire disponible avec le plan Premium', upgradeUrl: '/pricing' },
      { status: 402 }
    );
  }

  // 2. Payload size guard (max 10 KB)
  const contentLength = Number(request.headers.get('content-length') ?? 0);
  if (contentLength > 10_240) {
    return NextResponse.json({ error: 'Payload trop volumineux' }, { status: 400 });
  }

  // 3. Parse + validate
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 });
  }

  const parsed = itinerarySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Paramètres invalides', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  // 4. Generate
  try {
    const itinerary = await generateItinerary(parsed.data);
    const response: ItineraryApiResponse = {
      itinerary,
      meta: {
        premiumOnly: true,
        source: 'ai',
        officialDataMode: 'static',
      },
    };
    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('[API/itinerary]', error);
    return NextResponse.json({ error: 'Erreur lors de la génération de l\'itinéraire' }, { status: 500 });
  }
}
