import { NextResponse } from 'next/server';
import { z } from 'zod';
import { calculateCrisisScore } from '@/lib/services/scoring/crisisScore.service';
import { generateDestinationNarrative } from '@/lib/claude/claude.service';
import { findCountry } from '@/lib/utils/countries';

const QSchema = z.object({
  travelType: z.enum(['solo', 'couple', 'family', 'nomad']).default('solo'),
  budget: z.coerce.number().default(1500),
  duration: z.coerce.number().default(7),
});

export async function GET(
  req: Request,
  { params }: { params: Promise<{ code: string }> }
): Promise<NextResponse> {
  const { code } = await params;
  const country = findCountry(code);
  if (!country) return NextResponse.json({ error: 'Pays non trouvé' }, { status: 404 });

  const url = new URL(req.url);
  const q = QSchema.parse(Object.fromEntries(url.searchParams));
  const profile = { ...q, departureCountry: 'FR', period: 'flexible', mode: 'standard' as const };

  try {
    const score = await calculateCrisisScore(country, profile);
    const narrative = await generateDestinationNarrative(score, profile);
    return NextResponse.json({ score, narrative });
  } catch (error) {
    console.error('[API/explain]', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
