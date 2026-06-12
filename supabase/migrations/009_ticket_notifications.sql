-- =============================================================================
-- 009_ticket_notifications.sql
-- Extends the ticket system with email communication support:
-- - tickets.due_date, tickets.requester_user_id
-- - ticket_followers
-- - ticket_email_jobs, ticket_email_deliveries
-- - ticket_automation_rules
-- Run after 008_notification_campaigns.sql.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Enums
-- ---------------------------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE public.ticket_email_type AS ENUM (
    'reminder', 'follow_up', 'status_update', 'assignment',
    'overdue', 'resolution', 'creation', 'closure'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.ticket_email_trigger AS ENUM (
    'manual', 'automatic'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.automation_event AS ENUM (
    'ticket_created', 'ticket_assigned', 'ticket_status_changed',
    'ticket_overdue', 'ticket_pending_response', 'ticket_resolved', 'ticket_closed'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- 2. Extend tickets table
-- ---------------------------------------------------------------------------

ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS due_date           timestamptz,
  ADD COLUMN IF NOT EXISTS requester_user_id  uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tickets_due_date          ON public.tickets(due_date);
CREATE INDEX IF NOT EXISTS idx_tickets_requester_user_id ON public.tickets(requester_user_id);

-- ---------------------------------------------------------------------------
-- 3. ticket_followers  (users who want notifications for a ticket)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.ticket_followers (
  ticket_id   uuid        NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  profile_id  uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  followed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (ticket_id, profile_id)
);

CREATE INDEX IF NOT EXISTS idx_ticket_followers_ticket  ON public.ticket_followers(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_followers_profile ON public.ticket_followers(profile_id);

ALTER TABLE public.ticket_followers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users read ticket_followers"
  ON public.ticket_followers FOR SELECT TO authenticated USING (true);

-- ---------------------------------------------------------------------------
-- 4. ticket_email_jobs
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.ticket_email_jobs (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id           uuid        NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  -- which template was used (references ticket_email_templates.event_key)
  event_key           text        NOT NULL,
  email_type          public.ticket_email_type NOT NULL,
  trigger_type        public.ticket_email_trigger NOT NULL DEFAULT 'manual',
  -- who triggered the send (null = system/automation)
  triggered_by        uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  recipient_profile_id uuid       REFERENCES public.profiles(id) ON DELETE SET NULL,
  recipient_email     text        NOT NULL,
  subject             text        NOT NULL,
  html_body           text        NOT NULL,
  plain_body          text        NOT NULL DEFAULT '',
  -- snapshot of the variables used at send time
  variables_used      jsonb       NOT NULL DEFAULT '{}',
  status              public.job_status NOT NULL DEFAULT 'pending',
  idempotency_key     text        UNIQUE NOT NULL,
  scheduled_at        timestamptz NOT NULL DEFAULT now(),
  processed_at        timestamptz,
  provider_message_id text,
  provider_response   jsonb,
  attempt_count       integer     NOT NULL DEFAULT 0,
  max_attempts        integer     NOT NULL DEFAULT 3,
  last_error          text,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ticket_email_jobs_ticket     ON public.ticket_email_jobs(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_email_jobs_status     ON public.ticket_email_jobs(status);
CREATE INDEX IF NOT EXISTS idx_ticket_email_jobs_event_key  ON public.ticket_email_jobs(event_key);
CREATE INDEX IF NOT EXISTS idx_ticket_email_jobs_recipient  ON public.ticket_email_jobs(recipient_profile_id);
CREATE INDEX IF NOT EXISTS idx_ticket_email_jobs_idempotency ON public.ticket_email_jobs(idempotency_key);

ALTER TABLE public.ticket_email_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users read ticket_email_jobs"
  ON public.ticket_email_jobs FOR SELECT TO authenticated USING (true);

-- ---------------------------------------------------------------------------
-- 5. ticket_email_deliveries  (append-only delivery events)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.ticket_email_deliveries (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id              uuid        NOT NULL REFERENCES public.ticket_email_jobs(id) ON DELETE CASCADE,
  status              public.delivery_status NOT NULL,
  provider_message_id text,
  provider_event      text,
  provider_response   jsonb,
  recorded_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ticket_email_deliveries_job    ON public.ticket_email_deliveries(job_id);
CREATE INDEX IF NOT EXISTS idx_ticket_email_deliveries_status ON public.ticket_email_deliveries(status);

ALTER TABLE public.ticket_email_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users read ticket_email_deliveries"
  ON public.ticket_email_deliveries FOR SELECT TO authenticated USING (true);

-- ---------------------------------------------------------------------------
-- 6. ticket_automation_rules
--    Configurable SLA-based rules that automatically enqueue ticket emails.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.ticket_automation_rules (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text        NOT NULL,
  description     text,
  event_key       text        NOT NULL,
  trigger_event   public.automation_event NOT NULL,
  -- delay in minutes after the trigger event before sending
  delay_minutes   integer     NOT NULL DEFAULT 0,
  -- only fire when ticket is in these statuses (null = any)
  filter_statuses text[],
  -- only fire for tickets with these priorities (null = any)
  filter_priorities text[],
  is_active       boolean     NOT NULL DEFAULT true,
  created_by      uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by      uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ticket_automation_rules_active      ON public.ticket_automation_rules(is_active);
CREATE INDEX IF NOT EXISTS idx_ticket_automation_rules_trigger     ON public.ticket_automation_rules(trigger_event);

DROP TRIGGER IF EXISTS ticket_automation_rules_updated_at ON public.ticket_automation_rules;
CREATE TRIGGER ticket_automation_rules_updated_at
  BEFORE UPDATE ON public.ticket_automation_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.ticket_automation_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users read ticket_automation_rules"
  ON public.ticket_automation_rules FOR SELECT TO authenticated USING (true);

-- ---------------------------------------------------------------------------
-- 7. Seed: default automation rules
-- ---------------------------------------------------------------------------

INSERT INTO public.ticket_automation_rules
  (name, description, event_key, trigger_event, delay_minutes, filter_statuses, filter_priorities, is_active)
VALUES
  (
    'Recordatorio de ticket sin respuesta (24h)',
    'Envía un recordatorio si el ticket lleva 24h sin actividad en estado open o in_progress.',
    'ticket_pending_response',
    'ticket_pending_response',
    1440,
    ARRAY['open', 'in_progress'],
    NULL,
    true
  ),
  (
    'Recordatorio de ticket vencido',
    'Envía un email de vencimiento cuando un ticket supera su due_date.',
    'ticket_overdue',
    'ticket_overdue',
    0,
    ARRAY['open', 'in_progress'],
    NULL,
    true
  ),
  (
    'Email al asignar ticket',
    'Notifica al responsable asignado cuando se le asigna un ticket.',
    'ticket_assigned',
    'ticket_assigned',
    0,
    NULL,
    NULL,
    true
  ),
  (
    'Notificación de ticket resuelto',
    'Informa al solicitante cuando el ticket es marcado como resuelto.',
    'ticket_resolved',
    'ticket_resolved',
    0,
    NULL,
    NULL,
    true
  )
ON CONFLICT DO NOTHING;
