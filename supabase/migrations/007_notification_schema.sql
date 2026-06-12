-- =============================================================================
-- 007_notification_schema.sql
-- Core notification infrastructure: templates, preferences, device tokens,
-- and audit log. Run after 006_ticket_relations.sql.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Enums
-- ---------------------------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE public.notification_channel AS ENUM ('email', 'push');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.audience_type AS ENUM ('athlete', 'staff', 'mixed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.selection_mode AS ENUM ('individual', 'collective');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.template_status AS ENUM ('draft', 'active', 'archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.push_platform AS ENUM ('ios', 'android', 'web');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.audit_action AS ENUM (
    'template_created', 'template_updated', 'template_archived',
    'campaign_created', 'campaign_updated', 'campaign_paused',
    'campaign_deleted', 'campaign_sent',
    'preference_updated',
    'ticket_email_sent', 'ticket_rule_created', 'ticket_rule_updated'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- 2. email_templates
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.email_templates (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text        NOT NULL,
  description     text,
  subject         text        NOT NULL,
  html_body       text        NOT NULL,
  plain_body      text        NOT NULL DEFAULT '',
  -- comma-separated list of supported variable names for documentation
  variables       text[]      NOT NULL DEFAULT '{}',
  status          public.template_status NOT NULL DEFAULT 'draft',
  version         integer     NOT NULL DEFAULT 1,
  -- null = not a version copy; uuid = references the original template
  parent_id       uuid        REFERENCES public.email_templates(id) ON DELETE SET NULL,
  created_by      uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by      uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_templates_status    ON public.email_templates(status);
CREATE INDEX IF NOT EXISTS idx_email_templates_parent_id ON public.email_templates(parent_id);

-- ---------------------------------------------------------------------------
-- 3. push_templates
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.push_templates (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text        NOT NULL,
  description     text,
  title           text        NOT NULL,
  message         text        NOT NULL,
  -- optional deep link / screen route for the mobile app
  deep_link       text,
  -- arbitrary JSON payload forwarded to the device
  extra_data      jsonb       NOT NULL DEFAULT '{}',
  variables       text[]      NOT NULL DEFAULT '{}',
  status          public.template_status NOT NULL DEFAULT 'draft',
  version         integer     NOT NULL DEFAULT 1,
  parent_id       uuid        REFERENCES public.push_templates(id) ON DELETE SET NULL,
  created_by      uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by      uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_push_templates_status ON public.push_templates(status);

-- ---------------------------------------------------------------------------
-- 4. ticket_email_templates
--    Fixed-key templates mapped to ticket lifecycle events.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.ticket_email_templates (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- e.g. 'ticket_created', 'ticket_assigned', 'ticket_overdue' …
  event_key       text        UNIQUE NOT NULL,
  name            text        NOT NULL,
  description     text,
  subject         text        NOT NULL,
  html_body       text        NOT NULL,
  plain_body      text        NOT NULL DEFAULT '',
  variables       text[]      NOT NULL DEFAULT '{}',
  is_active       boolean     NOT NULL DEFAULT true,
  created_by      uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by      uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ticket_email_templates_event_key ON public.ticket_email_templates(event_key);
CREATE INDEX IF NOT EXISTS idx_ticket_email_templates_active    ON public.ticket_email_templates(is_active);

-- ---------------------------------------------------------------------------
-- 5. notification_preferences  (per-user, per-channel)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.notification_preferences (
  profile_id      uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  channel         public.notification_channel NOT NULL,
  enabled         boolean     NOT NULL DEFAULT true,
  -- when true this channel cannot be disabled (e.g. critical system alerts)
  is_mandatory    boolean     NOT NULL DEFAULT false,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (profile_id, channel)
);

CREATE INDEX IF NOT EXISTS idx_notif_prefs_profile ON public.notification_preferences(profile_id);

-- ---------------------------------------------------------------------------
-- 6. push_device_tokens
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.push_device_tokens (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id      uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- OneSignal player/subscription ID
  onesignal_player_id text    UNIQUE,
  -- raw FCM/APNs token (kept for reference / fallback)
  device_token    text,
  platform        public.push_platform NOT NULL DEFAULT 'android',
  device_name     text,
  is_active       boolean     NOT NULL DEFAULT true,
  last_seen_at    timestamptz,
  registered_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_push_tokens_profile    ON public.push_device_tokens(profile_id);
CREATE INDEX IF NOT EXISTS idx_push_tokens_active     ON public.push_device_tokens(is_active);
CREATE INDEX IF NOT EXISTS idx_push_tokens_onesignal  ON public.push_device_tokens(onesignal_player_id);

-- ---------------------------------------------------------------------------
-- 7. notification_audit_log
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.notification_audit_log (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  action          public.audit_action NOT NULL,
  performed_by    uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  -- the entity being acted on (template id, campaign id, etc.)
  entity_type     text,
  entity_id       uuid,
  metadata        jsonb       NOT NULL DEFAULT '{}',
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_action       ON public.notification_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_log_performed_by ON public.notification_audit_log(performed_by);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity       ON public.notification_audit_log(entity_type, entity_id);

-- ---------------------------------------------------------------------------
-- 8. updated_at triggers (reuse existing function from 005_tickets.sql)
-- ---------------------------------------------------------------------------

DROP TRIGGER IF EXISTS email_templates_updated_at    ON public.email_templates;
CREATE TRIGGER email_templates_updated_at
  BEFORE UPDATE ON public.email_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS push_templates_updated_at     ON public.push_templates;
CREATE TRIGGER push_templates_updated_at
  BEFORE UPDATE ON public.push_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS ticket_email_templates_updated_at ON public.ticket_email_templates;
CREATE TRIGGER ticket_email_templates_updated_at
  BEFORE UPDATE ON public.ticket_email_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- 9. Row-Level Security
-- ---------------------------------------------------------------------------

ALTER TABLE public.email_templates         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_templates          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_email_templates  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_device_tokens      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_audit_log  ENABLE ROW LEVEL SECURITY;

-- Templates: all authenticated users can read active templates
CREATE POLICY "Auth users read email_templates"
  ON public.email_templates FOR SELECT TO authenticated USING (true);

CREATE POLICY "Auth users read push_templates"
  ON public.push_templates FOR SELECT TO authenticated USING (true);

CREATE POLICY "Auth users read ticket_email_templates"
  ON public.ticket_email_templates FOR SELECT TO authenticated USING (true);

-- Preferences: users can only read/write their own rows
CREATE POLICY "Users read own preferences"
  ON public.notification_preferences FOR SELECT TO authenticated
  USING (profile_id = (
    SELECT id FROM public.profiles WHERE auth_user_id = auth.uid() LIMIT 1
  ));

CREATE POLICY "Users update own preferences"
  ON public.notification_preferences FOR UPDATE TO authenticated
  USING (profile_id = (
    SELECT id FROM public.profiles WHERE auth_user_id = auth.uid() LIMIT 1
  ));

-- Device tokens: users manage their own tokens
CREATE POLICY "Users read own device tokens"
  ON public.push_device_tokens FOR SELECT TO authenticated
  USING (profile_id = (
    SELECT id FROM public.profiles WHERE auth_user_id = auth.uid() LIMIT 1
  ));

CREATE POLICY "Users insert own device tokens"
  ON public.push_device_tokens FOR INSERT TO authenticated
  WITH CHECK (profile_id = (
    SELECT id FROM public.profiles WHERE auth_user_id = auth.uid() LIMIT 1
  ));

CREATE POLICY "Users update own device tokens"
  ON public.push_device_tokens FOR UPDATE TO authenticated
  USING (profile_id = (
    SELECT id FROM public.profiles WHERE auth_user_id = auth.uid() LIMIT 1
  ));

-- Audit log: read-only for authenticated users; writes via service role only
CREATE POLICY "Auth users read audit log"
  ON public.notification_audit_log FOR SELECT TO authenticated USING (true);

-- ---------------------------------------------------------------------------
-- 10. Seed: default ticket email templates
-- ---------------------------------------------------------------------------

INSERT INTO public.ticket_email_templates
  (event_key, name, description, subject, html_body, plain_body, variables, is_active)
VALUES
  (
    'ticket_created',
    'Ticket Creado',
    'Enviado cuando se crea un nuevo ticket.',
    'Nuevo ticket: {{ticket_title}} [#{{ticket_id}}]',
    '<p>Hola {{requester_name}},</p><p>Tu ticket <strong>{{ticket_title}}</strong> ({{ticket_id}}) ha sido creado con prioridad <strong>{{ticket_priority}}</strong>.</p><p><a href="{{ticket_link}}">Ver ticket</a></p>',
    'Hola {{requester_name}}, tu ticket {{ticket_title}} ({{ticket_id}}) ha sido creado.',
    ARRAY['ticket_id','ticket_title','ticket_status','ticket_priority','ticket_created_at','requester_name','ticket_link'],
    true
  ),
  (
    'ticket_assigned',
    'Ticket Asignado',
    'Enviado cuando un ticket es asignado a un responsable.',
    'Ticket asignado: {{ticket_title}} [#{{ticket_id}}]',
    '<p>Hola {{assigned_to_name}},</p><p>Se te ha asignado el ticket <strong>{{ticket_title}}</strong> con prioridad <strong>{{ticket_priority}}</strong>.</p><p><a href="{{ticket_link}}">Ver ticket</a></p>',
    'Hola {{assigned_to_name}}, se te asignó el ticket {{ticket_title}} ({{ticket_id}}).',
    ARRAY['ticket_id','ticket_title','ticket_priority','assigned_to_name','ticket_link'],
    true
  ),
  (
    'ticket_reassigned',
    'Ticket Reasignado',
    'Enviado cuando un ticket es reasignado a otra persona.',
    'Ticket reasignado: {{ticket_title}} [#{{ticket_id}}]',
    '<p>Hola {{assigned_to_name}},</p><p>El ticket <strong>{{ticket_title}}</strong> ha sido reasignado a ti.</p><p><a href="{{ticket_link}}">Ver ticket</a></p>',
    'Hola {{assigned_to_name}}, el ticket {{ticket_title}} te ha sido reasignado.',
    ARRAY['ticket_id','ticket_title','assigned_to_name','ticket_link'],
    true
  ),
  (
    'ticket_status_updated',
    'Estado de Ticket Actualizado',
    'Enviado cuando cambia el estado de un ticket.',
    'Estado actualizado: {{ticket_title}} → {{ticket_status}}',
    '<p>El ticket <strong>{{ticket_title}}</strong> cambió de estado a <strong>{{ticket_status}}</strong>.</p><p><a href="{{ticket_link}}">Ver ticket</a></p>',
    'El ticket {{ticket_title}} cambió de estado a {{ticket_status}}.',
    ARRAY['ticket_id','ticket_title','ticket_status','ticket_link'],
    true
  ),
  (
    'ticket_pending_response',
    'Ticket Pendiente de Respuesta',
    'Enviado automáticamente cuando un ticket lleva tiempo sin respuesta.',
    'Recordatorio: ticket {{ticket_title}} espera respuesta',
    '<p>El ticket <strong>{{ticket_title}}</strong> lleva tiempo sin actividad. Por favor responde a la brevedad.</p><p><a href="{{ticket_link}}">Ver ticket</a></p>',
    'El ticket {{ticket_title}} espera respuesta.',
    ARRAY['ticket_id','ticket_title','ticket_status','assigned_to_name','ticket_link'],
    true
  ),
  (
    'ticket_follow_up',
    'Seguimiento de Ticket',
    'Email de seguimiento manual o automático.',
    'Seguimiento: {{ticket_title}} [#{{ticket_id}}]',
    '<p>Este es un recordatorio de seguimiento para el ticket <strong>{{ticket_title}}</strong>.</p><p>Estado actual: <strong>{{ticket_status}}</strong>.</p><p><a href="{{ticket_link}}">Ver ticket</a></p>',
    'Seguimiento del ticket {{ticket_title}} — estado: {{ticket_status}}.',
    ARRAY['ticket_id','ticket_title','ticket_status','latest_comment','ticket_link'],
    true
  ),
  (
    'ticket_overdue',
    'Ticket Vencido',
    'Enviado cuando un ticket supera su fecha límite.',
    'VENCIDO: {{ticket_title}} [#{{ticket_id}}]',
    '<p>⚠️ El ticket <strong>{{ticket_title}}</strong> está <strong>vencido</strong>. Fecha límite: {{ticket_due_date}}.</p><p><a href="{{ticket_link}}">Ver ticket</a></p>',
    'VENCIDO: el ticket {{ticket_title}} superó su fecha límite {{ticket_due_date}}.',
    ARRAY['ticket_id','ticket_title','ticket_due_date','ticket_status','ticket_link'],
    true
  ),
  (
    'ticket_resolved',
    'Ticket Resuelto',
    'Enviado cuando un ticket es marcado como resuelto.',
    'Ticket resuelto: {{ticket_title}} [#{{ticket_id}}]',
    '<p>¡Buenas noticias! El ticket <strong>{{ticket_title}}</strong> ha sido marcado como <strong>resuelto</strong>.</p><p><a href="{{ticket_link}}">Ver ticket</a></p>',
    'El ticket {{ticket_title}} ha sido resuelto.',
    ARRAY['ticket_id','ticket_title','ticket_status','ticket_link'],
    true
  ),
  (
    'ticket_closed',
    'Ticket Cerrado',
    'Enviado cuando un ticket es cerrado definitivamente.',
    'Ticket cerrado: {{ticket_title}} [#{{ticket_id}}]',
    '<p>El ticket <strong>{{ticket_title}}</strong> ha sido <strong>cerrado</strong>.</p><p><a href="{{ticket_link}}">Ver ticket</a></p>',
    'El ticket {{ticket_title}} ha sido cerrado.',
    ARRAY['ticket_id','ticket_title','ticket_status','ticket_link'],
    true
  )
ON CONFLICT (event_key) DO NOTHING;
