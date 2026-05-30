import { NextResponse } from 'next/server';
import { calculateCrisisScore } from '@/lib/services/scoring/crisisScore.service';
import { generateDestinationNarrative } from '@/lib/claude/claude.service';
import { findCountry } from '@/lib/utils/countries';
import { getUserWithSubscription } from '@/lib/auth/supabase-server';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ code: string }> }
): Promise<NextResponse> {
  const { code } = await params;

  // Auth + vérification Premium
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

  try {
    const profile = {
      departureCountry: 'FR', budget: 1500, duration: 7,
      period: 'flexible', travelType: 'solo' as const, mode: 'standard' as const,
    };

    const score = await calculateCrisisScore(country, profile);
    const narrative = await generateDestinationNarrative(score, profile);

    // Import dynamique pour éviter les problèmes de type avec @react-pdf/renderer
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { renderToBuffer } = require('@react-pdf/renderer') as { renderToBuffer: (el: unknown) => Promise<Buffer> };
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const React = require('react');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { TravelReport } = require('@/lib/pdf/report.service');

    const pdfBuffer: Buffer = await renderToBuffer(
      React.createElement(TravelReport, { score, narrative })
    );

    const filename = `crisis-travel-${country.name.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}.pdf`;
    const uint8 = new Uint8Array(pdfBuffer);

    return new NextResponse(uint8, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('[API/export-pdf]', error);
    return NextResponse.json({ error: 'Erreur génération PDF' }, { status: 500 });
  }
}
