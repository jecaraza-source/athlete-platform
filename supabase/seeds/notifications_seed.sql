-- =============================================================================
-- notifications_seed.sql
-- Demo / development seed data for the notification system.
-- Run AFTER migrations 007-010 have been applied.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Email templates (reminders)
-- ---------------------------------------------------------------------------

INSERT INTO public.email_templates
  (name, description, subject, html_body, plain_body, variables, status)
VALUES
  (
    'Recordatorio de Entrenamiento',
    'Recordatorio semanal de sesión de entrenamiento para atletas.',
    'Recordatorio: sesión de entrenamiento — {{event_date}}',
    '<h1>Hola {{first_name}},</h1><p>Te recordamos que tienes una sesión de entrenamiento el <strong>{{event_date}}</strong>.</p><p>Equipo: <strong>{{team_name}}</strong></p>',
    'Hola {{first_name}}, tienes entrenamiento el {{event_date}} con {{team_name}}.',
    ARRAY['first_name', 'last_name', 'event_date', 'team_name'],
    'active'
  ),
  (
    'Recordatorio de Evaluación Médica',
    'Notificación de cita médica pendiente.',
    'Cita médica programada — {{event_date}}',
    '<h1>Hola {{first_name}},</h1><p>Tienes una evaluación médica el <strong>{{event_date}}</strong>.</p>',
    'Hola {{first_name}}, evaluación médica el {{event_date}}.',
    ARRAY['first_name', 'event_date'],
    'draft'
  )
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2. Push templates
-- ---------------------------------------------------------------------------

INSERT INTO public.push_templates
  (name, description, title, message, variables, status)
VALUES
  (
    'Recordatorio Push — Entrenamiento',
    'Notificación push de recordatorio de entrenamiento.',
    'Recordatorio de entrenamiento 💪',
    'Hola {{first_name}}, tienes entrenamiento hoy. ¡No faltes!',
    ARRAY['first_name'],
    'active'
  ),
  (
    'Aviso Push — Ticket pendiente',
    'Notifica al staff sobre un ticket sin resolver.',
    'Ticket pendiente 🎫',
    'El ticket "{{ticket_title}}" está esperando tu atención.',
    ARRAY['ticket_title'],
    'draft'
  )
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- 3. Sample automation rule (in addition to migration defaults)
-- ---------------------------------------------------------------------------

INSERT INTO public.ticket_automation_rules
  (name, description, event_key, trigger_event, delay_minutes, filter_statuses, filter_priorities, is_active)
VALUES
  (
    'Seguimiento urgente (2h)',
    'Envía un seguimiento si el ticket es urgente y lleva 2h sin respuesta.',
    'ticket_follow_up',
    'ticket_pending_response',
    120,
    ARRAY['open', 'in_progress'],
    ARRAY['urgent'],
    true
  )
ON CONFLICT DO NOTHING;
