-- Migration 005 : étend l'ensemble des catégories d'affiliation autorisées.
-- Additive et rétro-compatible. AUCUNE donnée n'est insérée ni modifiée.
--
-- Contexte : la migration 003 déclarait CHECK (category IN ('flight','hotel','insurance'))
-- en INLINE ANONYME sur deux tables (affiliate_partners et affiliate_clicks). Pour préparer
-- l'activation future de partenaires Travelpayouts dans de nouvelles catégories
-- (Welcome Pickups/GetTransfer = transfer, Tiqets = activity, Airalo = esim — activation
-- réservée à un GOAL ultérieur, data-only), on élargit l'ensemble autorisé.
--
-- Sûreté : on ne fait qu'ÉLARGIR le set autorisé → toutes les lignes existantes
-- (flight/hotel/insurance) restent valides, aucune violation possible. Aucun INSERT/UPDATE.
--
-- Robustesse au nom : un CHECK inline anonyme reçoit un nom généré par Postgres
-- (typiquement <table>_<column>_check), mais on ne s'appuie PAS sur cette supposition :
-- le bloc DO ci-dessous retrouve et drope dynamiquement tout CHECK portant sur `category`,
-- quel que soit son nom réel, avant de recréer la contrainte élargie sous un nom explicite.

DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT con.conname, rel.relname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = rel.relnamespace
    WHERE n.nspname = 'public'
      AND rel.relname IN ('affiliate_partners', 'affiliate_clicks')
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%category%'
  LOOP
    EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', c.relname, c.conname);
  END LOOP;
END $$;

ALTER TABLE public.affiliate_partners
  ADD CONSTRAINT affiliate_partners_category_check
  CHECK (category IN ('flight', 'hotel', 'insurance', 'transfer', 'activity', 'esim'));

ALTER TABLE public.affiliate_clicks
  ADD CONSTRAINT affiliate_clicks_category_check
  CHECK (category IN ('flight', 'hotel', 'insurance', 'transfer', 'activity', 'esim'));
