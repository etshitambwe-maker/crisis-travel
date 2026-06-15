-- Migration 006 : user_analyses
-- Historique personnel des analyses par utilisateur connecté.
-- Distinct de crisis_score_history (time-series globale par pays sans user_id).

CREATE TABLE IF NOT EXISTS public.user_analyses (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  country_code       CHAR(2)     NOT NULL,
  country_name       TEXT        NOT NULL,
  crisis_score       INT         NOT NULL CHECK (crisis_score BETWEEN 0 AND 100),
  security_score     INT         CHECK (security_score BETWEEN 0 AND 100),
  geopolitical_score INT         CHECK (geopolitical_score BETWEEN 0 AND 100),
  budget_score       INT         CHECK (budget_score BETWEEN 0 AND 100),
  travel_type        TEXT        CHECK (travel_type IN ('solo', 'couple', 'family', 'nomad')),
  duration           INT,
  budget             INT,
  mode               TEXT        CHECK (mode IN ('standard', 'bunker', 'budget_crisis')),
  status             TEXT        CHECK (status IN ('ideal', 'recommended', 'possible', 'discouraged')),
  confidence         TEXT        CHECK (confidence IN ('high', 'medium', 'low')),
  analyzed_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_analyses_user_date
  ON public.user_analyses(user_id, analyzed_at DESC);

ALTER TABLE public.user_analyses ENABLE ROW LEVEL SECURITY;

-- L'utilisateur ne voit que ses propres analyses
CREATE POLICY "Users can view own analyses"
  ON public.user_analyses FOR SELECT
  USING (auth.uid() = user_id);

-- Seul le service role peut insérer (depuis /api/analyze server-side)
CREATE POLICY "Service role can insert analyses"
  ON public.user_analyses FOR INSERT
  WITH CHECK (auth.role() = 'service_role');
