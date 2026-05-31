-- Migration 003 : socle affiliation voyage (vols / hôtels / assurances)
-- Additive uniquement. Aucun partenaire réel n'est connecté : les IDs d'affiliation
-- restent NULL jusqu'à inscription effective aux programmes (Booking, Skyscanner, etc.).
--
-- 3 tables :
--   affiliate_partners     — config centralisée d'un partenaire (1 ligne = 1 programme)
--   affiliate_clicks       — 1 ligne par clic sortant tracé via /api/affiliate/click
--   affiliate_conversions  — 1 ligne par conversion confirmée (table prête, pas de handler live)

-- ── 1. Partenaires ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.affiliate_partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,                       -- identifiant stable (ex: 'skyscanner')
  name TEXT NOT NULL,                              -- nom affiché
  category TEXT NOT NULL
    CHECK (category IN ('flight', 'hotel', 'insurance')),
  base_url TEXT NOT NULL,                          -- URL de destination (sans ID d'affiliation)
  affiliate_id TEXT,                               -- ID d'affiliation réel — NULL tant que non inscrit
  url_param TEXT,                                  -- nom du param où injecter affiliate_id (ex: 'aid')
  commission_rate NUMERIC(5,2),                    -- taux indicatif en % (NULL si inconnu)
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_affiliate_partners_category
  ON public.affiliate_partners(category, active);

ALTER TABLE public.affiliate_partners ENABLE ROW LEVEL SECURITY;

-- Lecture publique : la config partenaire (hors secret) sert à construire les liens côté front/serveur
CREATE POLICY "Anyone can read active partners"
  ON public.affiliate_partners FOR SELECT
  USING (active = true);

-- Seul le service role écrit/modifie la config (et lit l'affiliate_id)
CREATE POLICY "Service role full access partners"
  ON public.affiliate_partners
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ── 2. Clics ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.affiliate_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID REFERENCES public.affiliate_partners(id) ON DELETE SET NULL,
  partner_slug TEXT NOT NULL,                      -- dénormalisé : trace même si le partenaire est supprimé
  category TEXT NOT NULL
    CHECK (category IN ('flight', 'hotel', 'insurance')),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,  -- attribution optionnelle (clic anonyme OK)
  country_code CHAR(2),                            -- contexte : pays de la fiche destination
  country_name TEXT,
  estimated_total_eur INT,                         -- pack voyage estimé au moment du clic (contexte)
  referer TEXT,                                    -- page d'origine
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_affiliate_clicks_partner
  ON public.affiliate_clicks(partner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_affiliate_clicks_user
  ON public.affiliate_clicks(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_affiliate_clicks_country
  ON public.affiliate_clicks(country_code, created_at DESC);

ALTER TABLE public.affiliate_clicks ENABLE ROW LEVEL SECURITY;

-- Un utilisateur connecté peut relire ses propres clics (transparence)
CREATE POLICY "Users can read own clicks"
  ON public.affiliate_clicks FOR SELECT
  USING (auth.uid() = user_id);

-- L'écriture passe exclusivement par /api/affiliate/click (service role)
CREATE POLICY "Service role full access clicks"
  ON public.affiliate_clicks
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ── 3. Conversions ───────────────────────────────────────────────────────────
-- Table prête à recevoir les conversions confirmées par les programmes partenaires
-- (postback / webhook). Aucun handler n'est branché pour le moment.
CREATE TABLE IF NOT EXISTS public.affiliate_conversions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  click_id UUID REFERENCES public.affiliate_clicks(id) ON DELETE SET NULL,
  partner_id UUID REFERENCES public.affiliate_partners(id) ON DELETE SET NULL,
  partner_slug TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  external_order_id TEXT,                          -- réf de commande côté partenaire
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'cancelled', 'paid')),
  sale_amount_eur NUMERIC(10,2),                   -- montant de la vente
  commission_eur NUMERIC(10,2),                    -- commission perçue
  currency CHAR(3) NOT NULL DEFAULT 'EUR',
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_affiliate_conversions_partner
  ON public.affiliate_conversions(partner_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_affiliate_conversions_user
  ON public.affiliate_conversions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_affiliate_conversions_external
  ON public.affiliate_conversions(partner_slug, external_order_id);

ALTER TABLE public.affiliate_conversions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own conversions"
  ON public.affiliate_conversions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role full access conversions"
  ON public.affiliate_conversions
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ── 4. Triggers updated_at (réutilise public.update_updated_at de la migration 001) ──
DROP TRIGGER IF EXISTS set_updated_at_partners ON public.affiliate_partners;
CREATE TRIGGER set_updated_at_partners
  BEFORE UPDATE ON public.affiliate_partners
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_conversions ON public.affiliate_conversions;
CREATE TRIGGER set_updated_at_conversions
  BEFORE UPDATE ON public.affiliate_conversions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ── 5. Seed des 3 partenaires (IDs d'affiliation NULL — aucun programme connecté) ──
-- base_url calquée sur les liens déjà utilisés dans TravelPackBlock.tsx.
INSERT INTO public.affiliate_partners (slug, name, category, base_url, affiliate_id, url_param, commission_rate)
VALUES
  ('skyscanner', 'Skyscanner',     'flight',    'https://www.skyscanner.fr/transport/vols/', NULL, NULL, NULL),
  ('booking',    'Booking.com',    'hotel',     'https://www.booking.com/searchresults.fr.html', NULL, NULL, NULL),
  ('chapka',     'Chapka Direct',  'insurance', 'https://www.chapkadirect.fr/', NULL, NULL, NULL)
ON CONFLICT (slug) DO NOTHING;
