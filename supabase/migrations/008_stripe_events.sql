-- Migration 008 : stripe_events
-- Journal backend des événements Stripe reçus par le webhook.
-- Fournit idempotency (stripe_event_id unique) et audit trail.
-- Jamais exposé au frontend — service role uniquement.

CREATE TABLE IF NOT EXISTS public.stripe_events (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id    TEXT        NOT NULL UNIQUE,
  event_type         TEXT        NOT NULL,
  livemode           BOOLEAN     NOT NULL DEFAULT false,
  customer_id        TEXT,
  subscription_id    TEXT,
  user_id            UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  processing_status  TEXT        NOT NULL DEFAULT 'received'
    CONSTRAINT stripe_events_status_check
    CHECK (processing_status IN ('received','processing','processed','failed','ignored','duplicate')),
  error_message      TEXT,
  received_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at       TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stripe_events_customer
  ON public.stripe_events(customer_id);
CREATE INDEX IF NOT EXISTS idx_stripe_events_user
  ON public.stripe_events(user_id);
CREATE INDEX IF NOT EXISTS idx_stripe_events_received
  ON public.stripe_events(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_stripe_events_status
  ON public.stripe_events(processing_status);

-- RLS : table backend-only, jamais exposée au frontend
ALTER TABLE public.stripe_events ENABLE ROW LEVEL SECURITY;

-- Seul le service role peut lire/écrire
CREATE POLICY "stripe_events_service_role_only"
  ON public.stripe_events
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
