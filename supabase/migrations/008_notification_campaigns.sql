-- =============================================================================
-- 008_notification_campaigns.sql
-- Email & push campaigns, scheduled jobs, and delivery records.
-- Run after 007_notification_schema.sql.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Additional enums
-- ---------------------------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE public.campaign_status AS ENUM (
    'draft', 'scheduled', 'sending', 'sent', 'paused', 'failed', 'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.job_status AS ENUM (
    'pending', 'processing', 'sent', 'failed', 'cancelled', 'retrying'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.delivery_status AS ENUM (
    'sent', 'delivered', 'failed', 'bounced', 'opened', 'clicked',
    'invalid_token', 'unsubscribed'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.recurrence_type AS ENUM (
    'none', 'daily', 'weekly', 'monthly', 'custom'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- 2. email_campaigns
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.email_campaigns (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name                text        NOT NULL,
  description         text,
  template_id         uuid        REFERENCES public.email_templates(id) ON DELETE SET NULL,
  -- audience config stored as JSONB for flexibility
  -- e.g. {"mode":"collective","audience_type":"athlete","filters":{"status":"active"}}
  audience_config     jsonb       NOT NULL DEFAULT '{}',
  selection_mode      public.selection_mode NOT NULL DEFAULT 'collective',
  audience_type       public.audience_type  NOT NULL DEFAULT 'athlete',
  -- explicit list of profile IDs when mode = 'individual'
  recipient_ids       uuid[]      NOT NULL DEFAULT '{}',
  status              public.campaign_status NOT NULL DEFAULT 'draft',
  scheduled_at        timestamptz,
  sent_at             timestamptz,
  timezone            text        NOT NULL DEFAULT 'UTC',
  recurrence          public.recurrence_type NOT NULL DEFAULT 'none',
  recurrence_config   jsonb       NOT NULL DEFAULT '{}',
  -- template variable overrides applied to this campaign
  variable_overrides  jsonb       NOT NULL DEFAULT '{}',
  created_by          uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by          uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_campaigns_status       ON public.email_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_email_campaigns_scheduled_at ON public.email_campaigns(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_email_campaigns_template     ON public.email_campaigns(template_id);

-- ---------------------------------------------------------------------------
-- 3. push_campaigns
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.push_campaigns (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name                text        NOT NULL,
  description         text,
  template_id         uuid        REFERENCES public.push_templates(id) ON DELETE SET NULL,
  audience_config     jsonb       NOT NULL DEFAULT '{}',
  selection_mode      public.selection_mode NOT NULL DEFAULT 'collective',
  audience_type       public.audience_type  NOT NULL DEFAULT 'athlete',
  recipient_ids       uuid[]      NOT NULL DEFAULT '{}',
  status              public.campaign_status NOT NULL DEFAULT 'draft',
  scheduled_at        timestamptz,
  sent_at             timestamptz,
  timezone            text        NOT NULL DEFAULT 'UTC',
  recurrence          public.recurrence_type NOT NULL DEFAULT 'none',
  recurrence_config   jsonb       NOT NULL DEFAULT '{}',
  variable_overrides  jsonb       NOT NULL DEFAULT '{}',
  created_by          uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by          uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_push_campaigns_status       ON public.push_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_push_campaigns_scheduled_at ON public.push_campaigns(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_push_campaigns_template     ON public.push_campaigns(template_id);

-- ---------------------------------------------------------------------------
-- 4. email_jobs  (one row per individual email to send)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.email_jobs (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id         uuid        REFERENCES public.email_campaigns(id) ON DELETE CASCADE,
  -- null = standalone send (e.g. test send or direct reminder)
  template_id         uuid        REFERENCES public.email_templates(id) ON DELETE SET NULL,
  recipient_profile_id uuid       REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipient_email     text        NOT NULL,
  subject             text        NOT NULL,
  html_body           text        NOT NULL,
  plain_body          text        NOT NULL DEFAULT '',
  status              public.job_status NOT NULL DEFAULT 'pending',
  -- idempotency key prevents duplicate sends
  idempotency_key     text        UNIQUE NOT NULL,
  scheduled_at        timestamptz NOT NULL DEFAULT now(),
  processed_at        timestamptz,
  -- provider-assigned message ID (e.g. Resend message ID)
  provider_message_id text,
  provider_response   jsonb,
  attempt_count       integer     NOT NULL DEFAULT 0,
  max_attempts        integer     NOT NULL DEFAULT 3,
  last_error          text,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_jobs_status         ON public.email_jobs(status);
CREATE INDEX IF NOT EXISTS idx_email_jobs_scheduled_at   ON public.email_jobs(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_email_jobs_campaign       ON public.email_jobs(campaign_id);
CREATE INDEX IF NOT EXISTS idx_email_jobs_recipient      ON public.email_jobs(recipient_profile_id);
CREATE INDEX IF NOT EXISTS idx_email_jobs_idempotency    ON public.email_jobs(idempotency_key);

-- ---------------------------------------------------------------------------
-- 5. push_jobs  (one row per individual push notification to send)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.push_jobs (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id         uuid        REFERENCES public.push_campaigns(id) ON DELETE CASCADE,
  template_id         uuid        REFERENCES public.push_templates(id) ON DELETE SET NULL,
  recipient_profile_id uuid       REFERENCES public.profiles(id) ON DELETE CASCADE,
  device_token_id     uuid        REFERENCES public.push_device_tokens(id) ON DELETE SET NULL,
  onesignal_player_id text,
  title               text        NOT NULL,
  message             text        NOT NULL,
  deep_link           text,
  extra_data          jsonb       NOT NULL DEFAULT '{}',
  status              public.job_status NOT NULL DEFAULT 'pending',
  idempotency_key     text        UNIQUE NOT NULL,
  scheduled_at        timestamptz NOT NULL DEFAULT now(),
  processed_at        timestamptz,
  provider_notification_id text,
  provider_response   jsonb,
  attempt_count       integer     NOT NULL DEFAULT 0,
  max_attempts        integer     NOT NULL DEFAULT 3,
  last_error          text,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_push_jobs_status         ON public.push_jobs(status);
CREATE INDEX IF NOT EXISTS idx_push_jobs_scheduled_at   ON public.push_jobs(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_push_jobs_campaign       ON public.push_jobs(campaign_id);
CREATE INDEX IF NOT EXISTS idx_push_jobs_recipient      ON public.push_jobs(recipient_profile_id);
CREATE INDEX IF NOT EXISTS idx_push_jobs_idempotency    ON public.push_jobs(idempotency_key);

-- ---------------------------------------------------------------------------
-- 6. email_deliveries  (provider delivery events — append-only)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.email_deliveries (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id              uuid        NOT NULL REFERENCES public.email_jobs(id) ON DELETE CASCADE,
  status              public.delivery_status NOT NULL,
  provider_message_id text,
  provider_event      text,
  provider_response   jsonb,
  recorded_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_deliveries_job    ON public.email_deliveries(job_id);
CREATE INDEX IF NOT EXISTS idx_email_deliveries_status ON public.email_deliveries(status);

-- ---------------------------------------------------------------------------
-- 7. push_deliveries  (provider delivery events — append-only)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.push_deliveries (
  id                       uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id                   uuid        NOT NULL REFERENCES public.push_jobs(id) ON DELETE CASCADE,
  status                   public.delivery_status NOT NULL,
  provider_notification_id text,
  provider_event           text,
  provider_response        jsonb,
  recorded_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_push_deliveries_job    ON public.push_deliveries(job_id);
CREATE INDEX IF NOT EXISTS idx_push_deliveries_status ON public.push_deliveries(status);

-- ---------------------------------------------------------------------------
-- 8. updated_at triggers
-- ---------------------------------------------------------------------------

DROP TRIGGER IF EXISTS email_campaigns_updated_at ON public.email_campaigns;
CREATE TRIGGER email_campaigns_updated_at
  BEFORE UPDATE ON public.email_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS push_campaigns_updated_at ON public.push_campaigns;
CREATE TRIGGER push_campaigns_updated_at
  BEFORE UPDATE ON public.push_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- 9. Row-Level Security
-- ---------------------------------------------------------------------------

ALTER TABLE public.email_campaigns  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_campaigns   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_jobs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_jobs        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_deliveries  ENABLE ROW LEVEL SECURITY;

-- Admin-facing read: all authenticated users; writes go through service role
CREATE POLICY "Auth users read email_campaigns"
  ON public.email_campaigns FOR SELECT TO authenticated USING (true);

CREATE POLICY "Auth users read push_campaigns"
  ON public.push_campaigns FOR SELECT TO authenticated USING (true);

CREATE POLICY "Auth users read email_jobs"
  ON public.email_jobs FOR SELECT TO authenticated USING (true);

CREATE POLICY "Auth users read push_jobs"
  ON public.push_jobs FOR SELECT TO authenticated USING (true);

CREATE POLICY "Auth users read email_deliveries"
  ON public.email_deliveries FOR SELECT TO authenticated USING (true);

CREATE POLICY "Auth users read push_deliveries"
  ON public.push_deliveries FOR SELECT TO authenticated USING (true);
