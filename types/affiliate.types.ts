// Types du socle affiliation voyage (vols / hôtels / assurances).
// Reflètent les tables de la migration 003_affiliate.sql.

export type AffiliateCategory = 'flight' | 'hotel' | 'insurance';

export type ConversionStatus = 'pending' | 'confirmed' | 'cancelled' | 'paid';

/** Config d'un partenaire d'affiliation (1 ligne = 1 programme). */
export interface AffiliatePartner {
  id: string;
  slug: string;
  name: string;
  category: AffiliateCategory;
  baseUrl: string;
  /**
   * URL de redirection d'affiliation complète, fournie par le réseau (ex: Travelpayouts
   * 'https://kiwi.tpo.mx/...'). Utilisée TELLE QUELLE et prioritaire sur baseUrl+affiliateId :
   * c'est un deep-link autonome dans lequel on n'injecte rien. NULL si non configuré.
   */
  redirectUrl: string | null;
  /** ID d'affiliation réel — NULL tant qu'aucun programme n'est connecté. */
  affiliateId: string | null;
  /** Nom du query param où injecter affiliateId (ex: 'aid'). NULL si non applicable. */
  urlParam: string | null;
  commissionRate: number | null;
  active: boolean;
}

/** Contexte capturé au moment d'un clic sortant tracé. */
export interface AffiliateClickContext {
  countryCode?: string;
  countryName?: string;
  estimatedTotalEur?: number;
  referer?: string;
  userAgent?: string;
}

/** Un clic enregistré (table affiliate_clicks). */
export interface AffiliateClick extends AffiliateClickContext {
  id: string;
  partnerId: string | null;
  partnerSlug: string;
  category: AffiliateCategory;
  userId: string | null;
  createdAt: string;
}

/** Une conversion confirmée (table affiliate_conversions). Pas de handler live pour l'instant. */
export interface AffiliateConversion {
  id: string;
  clickId: string | null;
  partnerId: string | null;
  partnerSlug: string;
  userId: string | null;
  externalOrderId: string | null;
  status: ConversionStatus;
  saleAmountEur: number | null;
  commissionEur: number | null;
  currency: string;
  confirmedAt: string | null;
  createdAt: string;
}
