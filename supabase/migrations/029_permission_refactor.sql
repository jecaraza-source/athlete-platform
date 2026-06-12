-- =============================================================================
-- 029_permission_refactor.sql
--
-- Adds new permissions introduced by the mobile app changes (training, send
-- notifications) and fills in gaps in the existing role → permission matrix
-- so that EVERYTHING is controlled through the admin console by the superadmin.
--
-- Idempotent: uses ON CONFLICT DO NOTHING throughout.
--
-- NEW PERMISSIONS
-- ---------------
--   manage_training   – create sessions for athletes, reply to comments
--   view_training     – view own sessions, mark as done, write feedback
--   send_notifications – send push/email notifications to other users
--
-- ROLE MATRIX (full, including fixes to previous migrations)
-- -----------------------------------------------------------
-- Role              | manage_training | view_training | send_notifications | tickets
-- ------------------|-----------------|---------------|--------------------|---------
-- super_admin       |       ✓         |       ✓       |         ✓          | all
-- admin             |       ✓         |       ✓       |         ✓          | all
-- program_director  |       ✓         |       ✓       |         ✓          | all
-- coach             |       ✓         |       ✓       |         ✓          | view/create/edit/comment/close
-- staff             |       ✓         |       ✓       |         ✓          | view/create/comment
-- physio            |                 |       ✓       |         ✓          | view/create/comment
-- nutritionist      |                 |       ✓       |         ✓          | view/create/comment
-- psychologist      |                 |       ✓       |         ✓          | view/create/comment
-- medic             |                 |       ✓       |         ✓          | view/create/comment
-- athlete           |                 |       ✓       |         ✓          | view/create/comment
-- guardian          |                 |               |                    |
-- event_coordinator |                 |               |                    |
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Insert new permissions
-- ---------------------------------------------------------------------------
INSERT INTO public.permissions (name, description)
VALUES
  ('manage_training',
   'Create and manage training sessions for athletes; view all athlete sessions; reply to athlete feedback'),
  ('view_training',
   'View own training sessions; mark sessions as done; add feedback comments'),
  ('send_notifications',
   'Send push and email notifications to other users when creating tickets, events, or training sessions')
ON CONFLICT (name) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2. Ticket permissions for the athlete role (gap from migration 005)
-- ---------------------------------------------------------------------------
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM   public.roles r
JOIN   public.permissions p ON p.name IN (
  'view_tickets', 'create_tickets', 'comment_tickets'
)
WHERE  r.code = 'athlete'
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- 3. manage_training → staff-level roles
-- ---------------------------------------------------------------------------
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM   public.roles r
JOIN   public.permissions p ON p.name = 'manage_training'
WHERE  r.code IN ('super_admin', 'admin', 'program_director', 'coach', 'staff')
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- 4. view_training → all roles that interact with training data
-- ---------------------------------------------------------------------------
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM   public.roles r
JOIN   public.permissions p ON p.name = 'view_training'
WHERE  r.code IN (
  'super_admin', 'admin', 'program_director',
  'coach', 'staff',
  'physio', 'nutritionist', 'psychologist', 'medic',
  'athlete'
)
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- 5. send_notifications → all roles that can create tickets / events / sessions
-- ---------------------------------------------------------------------------
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM   public.roles r
JOIN   public.permissions p ON p.name = 'send_notifications'
WHERE  r.code IN (
  'super_admin', 'admin', 'program_director',
  'coach', 'staff',
  'physio', 'nutritionist', 'psychologist', 'medic',
  'athlete'
)
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- 6. assign_tickets: ensure coach has it (mobile app now uses it for the
--    assignee picker visibility; migration 005 omitted coach intentionally
--    but the app now lets coaches assign — add it here, superadmin can
--    revoke per role via the admin console)
-- ---------------------------------------------------------------------------
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM   public.roles r
JOIN   public.permissions p ON p.name = 'assign_tickets'
WHERE  r.code IN ('coach')
ON CONFLICT DO NOTHING;
