-- =============================================================================
-- 002_rbac_adapt.sql
-- Adapts the pre-existing `roles` and `user_roles` tables to the RBAC module
-- and creates the missing `permissions` + `role_permissions` tables.
--
-- Run in the Supabase SQL Editor AFTER 001_rbac.sql if you are starting fresh,
-- or as the ONLY migration if the project already had its own roles/user_roles.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Extend the existing `roles` table with columns the RBAC module expects.
--    Both columns are added safely; existing rows get sensible defaults.
-- ---------------------------------------------------------------------------

ALTER TABLE public.roles
  ADD COLUMN IF NOT EXISTS is_system  BOOLEAN     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Mark every role that existed before this migration as a protected system role
-- so the UI disables the Delete button for them.
UPDATE public.roles
SET    is_system = true
WHERE  code IN (
  'super_admin', 'program_director', 'coach', 'nutritionist',
  'physio', 'psychologist', 'event_coordinator', 'guardian', 'athlete'
);

-- ---------------------------------------------------------------------------
-- 2. Create `permissions` table (new — did not exist in the pre-existing schema)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.permissions (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        UNIQUE NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read permissions"
  ON public.permissions FOR SELECT TO authenticated USING (true);

-- ---------------------------------------------------------------------------
-- 3. Create `role_permissions` table
--    role_id is INTEGER to reference the existing roles.id column.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.role_permissions (
  role_id       INTEGER NOT NULL REFERENCES public.roles(id)       ON DELETE CASCADE,
  permission_id UUID    NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON public.role_permissions(role_id);

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read role_permissions"
  ON public.role_permissions FOR SELECT TO authenticated USING (true);

-- ---------------------------------------------------------------------------
-- 4. Seed: default permissions
-- ---------------------------------------------------------------------------

INSERT INTO public.permissions (name, description) VALUES
  ('view_athletes',       'Read athlete profiles and records'),
  ('create_athletes',     'Create new athlete profiles'),
  ('edit_athletes',       'Update existing athlete profiles'),
  ('delete_athletes',     'Delete athlete profiles'),
  ('view_calendar',       'View calendar events'),
  ('manage_calendar',     'Create, edit, and delete calendar events'),
  ('manage_users',        'Manage user accounts and profiles'),
  ('manage_roles',        'Create, edit, and delete roles'),
  ('manage_permissions',  'Assign and revoke permissions on roles')
ON CONFLICT (name) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 5. Seed: default role → permission assignments
--    Uses roles.code to look up roles.id, so order of insertion doesn't matter.
-- ---------------------------------------------------------------------------

-- super_admin: everything
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM   public.roles r
CROSS JOIN public.permissions p
WHERE  r.code = 'super_admin'
ON CONFLICT DO NOTHING;

-- program_director: everything except manage_permissions
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM   public.roles r
JOIN   public.permissions p ON p.name IN (
  'view_athletes', 'create_athletes', 'edit_athletes', 'delete_athletes',
  'view_calendar', 'manage_calendar', 'manage_users', 'manage_roles'
)
WHERE  r.code = 'program_director'
ON CONFLICT DO NOTHING;

-- coach: athlete read/create/edit + full calendar
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM   public.roles r
JOIN   public.permissions p ON p.name IN (
  'view_athletes', 'create_athletes', 'edit_athletes',
  'view_calendar', 'manage_calendar'
)
WHERE  r.code = 'coach'
ON CONFLICT DO NOTHING;

-- physio, nutritionist, psychologist: view + edit athletes + view calendar
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM   public.roles r
JOIN   public.permissions p ON p.name IN (
  'view_athletes', 'edit_athletes', 'view_calendar'
)
WHERE  r.code IN ('physio', 'nutritionist', 'psychologist')
ON CONFLICT DO NOTHING;

-- athlete, guardian, event_coordinator: view calendar only
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM   public.roles r
JOIN   public.permissions p ON p.name = 'view_calendar'
WHERE  r.code IN ('athlete', 'guardian', 'event_coordinator')
ON CONFLICT DO NOTHING;
