import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type {
  AffiliateCategory,
  AffiliatePartner,
  AffiliateClickContext,
} from '@/types/affiliate.types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabaseClient = SupabaseClient<any, any, any>;

/** Client service_role — écrit les clics sans dépendre du RLS user. null si env absent. */
function getAdminClient(): AnySupabaseClient | null {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return null;
  }
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

/** Ligne brute renvoyée par Supabase pour affiliate_partners. */
interface PartnerRow {
  id: string;
  slug: string;
  name: string;
  category: AffiliateCategory;
  base_url: string;
  affiliate_id: string | null;
  url_param: string | null;
  commission_rate: number | null;
  active: boolean;
}

function mapPartner(row: PartnerRow): AffiliatePartner {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    category: row.category,
    baseUrl: row.base_url,
    affiliateId: row.affiliate_id,
    urlParam: row.url_param,
    commissionRate: row.commission_rate,
    active: row.active,
  };
}

/** Résout un partenaire actif par slug (priorité) ou, à défaut, le premier de la catégorie. */
export async function resolvePartner(
  slug: string | null,
  category: AffiliateCategory
): Promise<AffiliatePartner | null> {
  const admin = getAdminClient();
  if (!admin) return null;

  if (slug) {
    const { data } = await admin
      .from('affiliate_partners')
      .select('*')
      .eq('slug', slug)
      .eq('active', true)
      .maybeSingle();
    if (data) return mapPartner(data as PartnerRow);
  }

  const { data } = await admin
    .from('affiliate_partners')
    .select('*')
    .eq('category', category)
    .eq('active', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  return data ? mapPartner(data as PartnerRow) : null;
}

/**
 * Construit l'URL de destination finale.
 * - Repart d'une `targetUrl` fournie par le front (déjà contextualisée : pays, aéroport…)
 *   ou, à défaut, de la `base_url` du partenaire.
 * - Injecte l'ID d'affiliation UNIQUEMENT si le partenaire en a un (sinon URL nue).
 *   Tant qu'aucun programme n'est connecté, affiliateId est NULL → lien public inchangé.
 */
export function buildAffiliateUrl(partner: AffiliatePartner, targetUrl?: string): string {
  const raw = targetUrl && isHttpUrl(targetUrl) ? targetUrl : partner.baseUrl;

  if (!partner.affiliateId || !partner.urlParam) {
    return raw;
  }

  try {
    const url = new URL(raw);
    url.searchParams.set(partner.urlParam, partner.affiliateId);
    return url.toString();
  } catch {
    return raw;
  }
}

/** Garde-fou : n'autorise que http(s) pour la redirection (anti open-redirect exotique). */
export function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Enregistre un clic sortant. Best-effort : ne bloque jamais la redirection.
 * Retourne l'id du clic créé, ou null si l'écriture a échoué / env absent.
 */
export async function logClick(
  partner: AffiliatePartner | null,
  category: AffiliateCategory,
  userId: string | null,
  ctx: AffiliateClickContext
): Promise<string | null> {
  const admin = getAdminClient();
  if (!admin) return null;

  try {
    const { data, error } = await admin
      .from('affiliate_clicks')
      .insert({
        partner_id: partner?.id ?? null,
        partner_slug: partner?.slug ?? 'unknown',
        category,
        user_id: userId,
        country_code: ctx.countryCode ?? null,
        country_name: ctx.countryName ?? null,
        estimated_total_eur: ctx.estimatedTotalEur ?? null,
        referer: ctx.referer ?? null,
        user_agent: ctx.userAgent ?? null,
      })
      .select('id')
      .single();

    if (error) return null;
    return (data as { id: string }).id;
  } catch {
    return null;
  }
}
