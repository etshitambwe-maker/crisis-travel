import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getUserWithSubscription } from '@/lib/auth/supabase-server';
import { getPerplexityCountryFacts } from '@/lib/services/geopolitical/perplexity.service';
import { generatePremiumCountryGuide } from '@/lib/claude/claude.service';
import { calculateCrisisScore } from '@/lib/services/scoring/crisisScore.service';
import { findCountry } from '@/lib/utils/countries';
import type { CountryGuideApiResponse } from '@/types/crisis.types';

// PREMIUM-GUIDE-001C — génération on-demand (jamais SSR). Perplexity + Claude en chaîne
// peuvent dépasser le défaut Vercel ; 60s = plafond du plan (pas une garantie).
export const maxDuration = 60;

const schema = z.object({
  countryCode: z.string().min(2).max(3).toUpperCase(),
  countryName: z.string().min(1).max(100),
  travelType: z.enum(['solo', 'couple', 'family', 'nomad']).optional(),
  budget: z.number().positive().max(1_000_000).optional(),
  duration: z.number().int().min(1).max(365).optional(),
});

export async function POST(request: Request): Promise<NextResponse> {
  const { user, isPremium } = await getUserWithSubscription();
  if (!user) {
    return NextResponse.json({ error: 'Authentification requise' }, { status: 401 });
  }
  if (!isPremium) {
    return NextResponse.json(
      { error: 'Guide pays disponible avec le plan Premium', upgradeUrl: '/pricing' },
      { status: 402 },
    );
  }

  const contentLength = Number(request.headers.get('content-length') ?? 0);
  if (contentLength > 10_240) {
    return NextResponse.json({ error: 'Payload trop volumineux' }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Paramètres invalides', details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  try {
    const country = findCountry(parsed.data.countryCode);
    if (!country) {
      return NextResponse.json({ error: 'Destination inconnue' }, { status: 400 });
    }

    // Score recalculé côté serveur (jamais faire confiance au client pour le snapshot).
    // Réutilise la fonction de scoring partagée — comme la page destination (getData).
    // Ce n'est PAS /api/analyze (chemin non touché) : sous-scores cachés en Redis.
    const profile = {
      departureCountry: 'FR',
      budget: parsed.data.budget ?? 1500,
      duration: parsed.data.duration ?? 7,
      period: 'flexible',
      travelType: parsed.data.travelType ?? ('solo' as const),
      mode: 'standard' as const,
    };
    const score = await calculateCrisisScore(country, profile);

    const factsResult = await getPerplexityCountryFacts(parsed.data.countryCode, parsed.data.countryName);
    const guide = await generatePremiumCountryGuide(score, factsResult.data, {
      travelType: profile.travelType,
      budget: profile.budget,
      duration: profile.duration,
    });

    const response: CountryGuideApiResponse = {
      guide,
      meta: { premiumOnly: true, source: 'ai', factsSource: factsResult.source === 'live' ? 'live' : 'derived' },
    };
    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('[API/country-guide]', error);
    return NextResponse.json({ error: 'Erreur lors de la génération du guide' }, { status: 500 });
  }
}
