-- Migration 004 : URL de redirection d'affiliation complète (deep-links réseau)
-- Additive et rétro-compatible. Ajoute une colonne nullable à affiliate_partners.
--
-- Contexte : certains programmes (Travelpayouts : Kiwi, Tiqets, Airalo, transferts…)
-- fournissent une URL de redirection COMPLÈTE et autonome (ex: https://kiwi.tpo.mx/XXXX),
-- incompatible avec le mécanisme base_url + url_param + affiliate_id (injection de query param).
--
-- Sémantique : redirect_url, si renseignée et valide (http/https), est utilisée TELLE QUELLE
-- et prioritaire sur base_url+affiliate_id (voir lib/services/affiliate/affiliate.service.ts:buildAffiliateUrl).
-- NULL (défaut) → comportement inchangé : injection de param ou lien public.
--
-- Sécurité : aucune URL réelle n'est seedée ici. L'activation se fait plus tard en data-only
-- (UPDATE manuel après revue), jamais automatiquement.

ALTER TABLE public.affiliate_partners
  ADD COLUMN IF NOT EXISTS redirect_url TEXT;

COMMENT ON COLUMN public.affiliate_partners.redirect_url IS
  'URL de redirection d''affiliation complète (deep-link réseau, ex: Travelpayouts). Utilisée telle quelle et prioritaire sur base_url+affiliate_id. NULL = comportement param/public inchangé.';
