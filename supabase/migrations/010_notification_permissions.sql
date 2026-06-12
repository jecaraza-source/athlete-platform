-- =============================================================================
-- 010_notification_permissions.sql
-- Notification module permissions, role assignments, and RBAC type updates.
-- Run after 009_ticket_notifications.sql.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. New permissions
-- ---------------------------------------------------------------------------

INSERT INTO public.permissions (name, description) VALUES
  ('manage_email_campaigns',       'Create, edit, send, pause and delete email reminder campaigns'),
  ('manage_push_campaigns',        'Create, edit, send, pause and delete push notification campaigns'),
  ('manage_notification_templates','Create, edit and archive notification templates (email & push)'),
  ('manage_ticket_emails',         'Send manual ticket emails and configure ticket automation rules'),
  ('view_notification_logs',       'Read notification delivery logs and audit history')
ON CONFLICT (name) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2. Role → permission assignments
-- ---------------------------------------------------------------------------

-- super_admin: gets everything (already handled by cross-join in 001_rbac.sql
-- if they re-run, but we ensure coverage here explicitly)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.code = 'super_admin'
  AND p.name IN (
    'manage_email_campaigns', 'manage_push_campaigns',
    'manage_notification_templates', 'manage_ticket_emails',
    'view_notification_logs'
  )
ON CONFLICT DO NOTHING;

-- admin / program_director: full notification management
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.name IN (
  'manage_email_campaigns', 'manage_push_campaigns',
  'manage_notification_templates', 'manage_ticket_emails',
  'view_notification_logs'
)
WHERE r.code IN ('admin', 'program_director')
ON CONFLICT DO NOTHING;

-- coach: can send ticket emails and view logs, but cannot manage templates/campaigns
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.name IN (
  'manage_ticket_emails', 'view_notification_logs'
)
WHERE r.code = 'coach'
ON CONFLICT DO NOTHING;

-- specialist staff roles: can view logs and send ticket emails
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.name IN (
  'manage_ticket_emails', 'view_notification_logs'
)
WHERE r.code IN ('physio', 'nutritionist', 'psychologist', 'medic', 'staff')
ON CONFLICT DO NOTHING;
