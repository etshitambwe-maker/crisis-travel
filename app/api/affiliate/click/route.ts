import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getUser } from '@/lib/auth/supabase-server';
import { resolvePartner, buildAffiliateUrl, isHttpUrl, logClick } from '@/lib/services/affiliate/affiliate.service';
import type { AffiliateCategory } from '@/types/affiliate.types';

// Validation des query params du clic sortant.
const ClickQuerySchema = z.object({
  category: z.enum(['flight', 'hotel', 'insurance']),
  partner: z.string().min(1).max(64).optional(),
  url: z.string().url().optional(),          // URL cible contextualisée fournie par le front
  country: z.string().length(2).optional(),
  countryName: z.string().max(120).optional(),
  total: z.coerce.number().int().min(0).max(1_000_000).optional(),
});

// Repli public si aucun partenaire n'est résolu (table vide / env absent),
// pour ne jamais laisser l'utilisateur sur une page d'erreur.
const FALLBACK_URL: Record<AffiliateCategory, string> = {
  flight: 'https://www.skyscanner.fr/',
  hotel: 'https://www.booking.com/',
  insurance: 'https://www.chapkadirect.fr/',
};

// GET /api/affiliate/click?category=...&partner=...&url=...&country=...&total=...
// Enregistre le clic (best-effort) PUIS redirige (302) vers le partenaire.
export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);

  const parsed = ClickQuerySchema.safeParse({
    category: searchParams.get('category') ?? undefined,
    partner: searchParams.get('partner') ?? undefined,
    url: searchParams.get('url') ?? undefined,
    country: searchParams.get('country') ?? undefined,
    countryName: searchParams.get('countryName') ?? undefined,
    total: searchParams.get('total') ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: 'Paramètres invalides', details: parsed.error.issues }, { status: 400 });
  }

  const { category, partner: partnerSlug, url, country, countryName, total } = parsed.data;

  // Attribution utilisateur optionnelle — un clic anonyme reste valide.
  const user = await getUser().catch(() => null);

  // Résolution partenaire + construction de l'URL finale (ID d'affiliation NULL pour l'instant).
  const partner = await resolvePartner(partnerSlug ?? null, category);
  const destination = partner
    ? buildAffiliateUrl(partner, url)
    : (url && isHttpUrl(url) ? url : FALLBACK_URL[category]);

  // Trace le clic — best-effort, ne bloque jamais la redirection.
  await logClick(partner, category, user?.id ?? null, {
    countryCode: country?.toUpperCase(),
    countryName,
    estimatedTotalEur: total,
    referer: request.headers.get('referer') ?? undefined,
    userAgent: request.headers.get('user-agent') ?? undefined,
  });

  return NextResponse.redirect(destination, { status: 302 });
}
