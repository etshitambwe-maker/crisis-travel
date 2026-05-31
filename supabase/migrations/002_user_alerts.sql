-- Migration 002 : user_alerts + crisis_score_history

-- Alertes pays par utilisateur
CREATE TABLE IF NOT EXISTS public.user_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  country_code CHAR(2) NOT NULL,
  country_name TEXT NOT NULL,
  threshold_score INT NOT NULL DEFAULT 60
    CHECK (threshold_score BETWEEN 0 AND 100),
  alert_types TEXT[] NOT NULL DEFAULT ARRAY['security_improved', 'cheap_flights'],
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_triggered_at TIMESTAMPTZ,
  last_score INT
);

CREATE INDEX IF NOT EXISTS idx_user_alerts_user ON public.user_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_user_alerts_active ON public.user_alerts(active, country_code);
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_alerts_unique ON public.user_alerts(user_id, country_code)
  WHERE active = true;

ALTER TABLE public.user_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own alerts"
  ON public.user_alerts
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role full access alerts"
  ON public.user_alerts
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Historique des CrisisScores (time series)
CREATE TABLE IF NOT EXISTS public.crisis_score_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code CHAR(2) NOT NULL,
  country_name TEXT NOT NULL,
  score INT NOT NULL CHECK (score BETWEEN 0 AND 100),
  security_score INT CHECK (security_score BETWEEN 0 AND 100),
  geopolitical_score INT CHECK (geopolitical_score BETWEEN 0 AND 100),
  budget_score INT CHECK (budget_score BETWEEN 0 AND 100),
  practicality_score INT CHECK (practicality_score BETWEEN 0 AND 100),
  confidence TEXT CHECK (confidence IN ('high', 'medium', 'low')),
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_score_history_country_date
  ON public.crisis_score_history(country_code, calculated_at DESC);

-- Pas de RLS sur l'historique — lecture publique OK
ALTER TABLE public.crisis_score_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read score history"
  ON public.crisis_score_history FOR SELECT
  USING (true);

CREATE POLICY "Service role can insert history"
  ON public.crisis_score_history FOR INSERT
  WITH CHECK (auth.role() = 'service_role');
