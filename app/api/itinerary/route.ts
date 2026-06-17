import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getUserWithSubscription } from '@/lib/auth/supabase-server';
import { generateItinerary } from '@/lib/claude/claude.service';
import { logger } from '@/lib/utils/logger';
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

// ── Helpers observabilité ─────────────────────────────────────────────────────

/** Tronque un userId à 8 chars pour les logs — jamais l'email, jamais le token. */
function safeUserId(id: string): string {
  return id.slice(0, 8);
}

type ItineraryStage =
  | 'auth'
  | 'premium_gate'
  | 'content_length'
  | 'parse_payload'
  | 'generate'
  | 'response'
  | 'unexpected';

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request: Request): Promise<NextResponse> {
  const t0 = Date.now();
  let stage: ItineraryStage = 'auth';

  // 1. Auth check
  let user: { id: string } | null = null;
  let isPremium = false;
  try {
    ({ user, isPremium } = await getUserWithSubscription());
  } catch (error) {
    logger.error('API/itinerary', error);
    logger.warn('API/itinerary', `stage=${stage} auth resolution failed durationMs=${Date.now() - t0}`);
    return NextResponse.json({ error: 'Authentification requise' }, { status: 401 });
  }

  if (!user) {
    logger.warn('API/itinerary', 'stage=auth status=401 reason=unauthenticated');
    return NextResponse.json(
      { error: 'Authentification requise' },
      { status: 401 }
    );
  }

  stage = 'premium_gate';
  if (!isPremium) {
    logger.warn('API/itinerary', `stage=premium_gate status=402 userId=${safeUserId(user.id)}`);
    return NextResponse.json(
      { error: 'Génération d\'itinéraire disponible avec le plan Premium', upgradeUrl: '/pricing' },
      { status: 402 }
    );
  }

  // 2. Payload size guard (max 10 KB)
  stage = 'content_length';
  const contentLength = Number(request.headers.get('content-length') ?? 0);
  if (contentLength > 10_240) {
    logger.warn('API/itinerary', `stage=content_length status=400 contentLength=${contentLength} userId=${safeUserId(user.id)}`);
    return NextResponse.json({ error: 'Payload trop volumineux' }, { status: 400 });
  }

  // 3. Parse + validate
  stage = 'parse_payload';
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    logger.warn('API/itinerary', `stage=parse_payload status=400 reason=invalid_json userId=${safeUserId(user.id)}`);
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 });
  }

  const parsed = itinerarySchema.safeParse(body);
  if (!parsed.success) {
    const flat = parsed.error.flatten();
    const paths = Object.keys(flat.fieldErrors);
    const codes = parsed.error.issues.map((i) => i.code);
    logger.warn(
      'API/itinerary',
      `stage=parse_payload status=400 validation_error issueCount=${parsed.error.issues.length} paths=[${paths.join(',')}] codes=[${codes.join(',')}] userId=${safeUserId(user.id)}`,
    );
    return NextResponse.json(
      { error: 'Paramètres invalides', details: flat.fieldErrors },
      { status: 400 }
    );
  }

  // 4. Log début — après validation, les champs sont sûrs
  const data = parsed.data;
  const days = data.from && data.to
    ? Math.max(1, Math.ceil((new Date(data.to).getTime() - new Date(data.from).getTime()) / 86400000))
    : (data.duration ?? 7);

  logger.warn(
    'API/itinerary',
    `stage=generate started userId=${safeUserId(user.id)} countryCode=${data.countryCode ?? data.countryName ?? 'unknown'} travelType=${data.travelType ?? 'solo'} days=${days} budget=${data.budget ?? 'none'} from=${data.from ?? '-'} to=${data.to ?? '-'}`,
  );

  // 5. Generate
  stage = 'generate';
  try {
    const itinerary = await generateItinerary(data);

    stage = 'response';
    const durationMs = Date.now() - t0;
    logger.warn(
      'API/itinerary',
      `stage=response completed status=200 countryCode=${data.countryCode ?? data.countryName ?? 'unknown'} travelType=${data.travelType ?? 'solo'} days=${days} isFallback=${!!itinerary.isFallback} durationMs=${durationMs}`,
    );

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
    const durationMs = Date.now() - t0;
    const errorName = error instanceof Error ? error.name : 'UnknownError';
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('API/itinerary', error);
    logger.warn(
      'API/itinerary',
      `stage=${stage} status=500 countryCode=${data.countryCode ?? data.countryName ?? 'unknown'} errorName=${errorName} errorMessage=${errorMessage} durationMs=${durationMs}`,
    );
    return NextResponse.json({ error: 'Erreur lors de la génération de l\'itinéraire' }, { status: 500 });
  }
}
