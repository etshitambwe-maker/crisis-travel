import { NextResponse } from 'next/server';
import { calculateCrisisScore } from '@/lib/services/scoring/crisisScore.service';
import { findCountry } from '@/lib/utils/countries';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ code: string }> }
): Promise<NextResponse> {
  const { code } = await params;
  const country = findCountry(code);
  if (!country) return NextResponse.json({ error: 'Pays non trouvé' }, { status: 404 });

  try {
    const score = await calculateCrisisScore(country, {
      departureCountry: 'FR', budget: 1500, duration: 7,
      period: 'flexible', travelType: 'solo', mode: 'standard',
    });
    return NextResponse.json(score, {
      headers: { 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600' },
    });
  } catch (error) {
    console.error('[API/destination]', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
