-- Migration 007 : ajout des dates de voyage dans user_analyses (TRAVEL-DATES-001)
-- Non-destructive : colonnes nullable, ADD COLUMN IF NOT EXISTS, aucun NOT NULL.
-- Compatible avec toutes les lignes existantes (departure_date/return_date = NULL).

ALTER TABLE public.user_analyses
  ADD COLUMN IF NOT EXISTS departure_date DATE,
  ADD COLUMN IF NOT EXISTS return_date    DATE;

COMMENT ON COLUMN public.user_analyses.departure_date IS 'Date de départ YYYY-MM-DD (nullable — absent pour les analyses antérieures à TRAVEL-DATES-001)';
COMMENT ON COLUMN public.user_analyses.return_date    IS 'Date de retour YYYY-MM-DD (nullable — absent pour les analyses antérieures à TRAVEL-DATES-001)';
