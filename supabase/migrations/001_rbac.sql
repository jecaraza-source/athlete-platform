-- =============================================================================
-- 001_rbac.sql
-- ⚠️  DEPRECATED — DO NOT RUN ON THIS PROJECT
--
-- This file was written as an alternative for projects with NO pre-existing
-- RBAC schema.  It creates a `roles` table with a UUID primary key.
--
-- The AO Deportes platform already has a `roles` table with a SERIAL INTEGER
-- primary key (documented in 000_base_schema.sql).  Running this file on top
-- of that schema will cause a FK type mismatch in 002_rbac_adapt.sql, which
-- creates `role_permissions.role_id INTEGER REFERENCES roles(id)`.
--
-- Correct migration order for a fresh install:
--   000_base_schema.sql  →  002_rbac_adapt.sql  →  003 … 014
--
-- See supabase/README.md for the full explanation.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Core RBAC tables
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.roles (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text UNIQUE NOT NULL,
  description text,
  is_system   boolean NOT NULL DEFAULT false,  -- system roles cannot be deleted
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.permissions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text UNIQUE NOT NULL,
  description text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.role_permissions (
  role_id       uuid NOT NULL REFERENCES public.roles(id)       ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS public.user_roles (
  profile_id           uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role_id              uuid NOT NULL REFERENCES public.roles(id)    ON DELETE CASCADE,
  assigned_at          timestamptz NOT NULL DEFAULT now(),
  assigned_by_profile_id uuid REFERENCES public.profiles(id)       ON DELETE SET NULL,
  PRIMARY KEY (profile_id, role_id)
);

-- ---------------------------------------------------------------------------
-- 2. Indexes for common query patterns
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_user_roles_profile_id   ON public.user_roles(profile_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role_id      ON public.user_roles(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON public.role_permissions(role_id);

-- ---------------------------------------------------------------------------
-- 3. Row-Level Security
-- ---------------------------------------------------------------------------

ALTER TABLE public.roles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles       ENABLE ROW LEVEL SECURITY;

-- Allow read access to authenticated users (service role bypasses RLS)
CREATE POLICY "Authenticated users can read roles"
  ON public.roles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can read permissions"
  ON public.permissions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can read role_permissions"
  ON public.role_permissions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can read user_roles"
  ON public.user_roles FOR SELECT TO authenticated USING (true);

-- All writes go through service-role (server actions) — no direct write policies for anon/authenticated

-- ---------------------------------------------------------------------------
-- 4. Seed: default roles
-- ---------------------------------------------------------------------------

INSERT INTO public.roles (name, description, is_system) VALUES
  ('super_admin',  'Full platform access, cannot be restricted',         true),
  ('admin',        'Administrative access to most platform features',    true),
  ('coach',        'Manage athletes, sessions, and calendar',            false),
  ('staff',        'Support staff with limited write permissions',       false),
  ('athlete',      'Athlete-level access to personal data and calendar', false)
ON CONFLICT (name) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 5. Seed: default permissions
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
-- 6. Seed: default role → permission assignments
-- ---------------------------------------------------------------------------

-- super_admin gets everything
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name = 'super_admin'
ON CONFLICT DO NOTHING;

-- admin gets everything except manage_permissions
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.name IN (
  'view_athletes', 'create_athletes', 'edit_athletes', 'delete_athletes',
  'view_calendar', 'manage_calendar', 'manage_users', 'manage_roles'
)
WHERE r.name = 'admin'
ON CONFLICT DO NOTHING;

-- coach: athlete read/create/edit + full calendar
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.name IN (
  'view_athletes', 'create_athletes', 'edit_athletes',
  'view_calendar', 'manage_calendar'
)
WHERE r.name = 'coach'
ON CONFLICT DO NOTHING;

-- staff: read-only on athletes + calendar view
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.name IN (
  'view_athletes', 'view_calendar'
)
WHERE r.name = 'staff'
ON CONFLICT DO NOTHING;

-- athlete: view calendar only
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.name IN (
  'view_calendar'
)
WHERE r.name = 'athlete'
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- 7. Backfill user_roles from profiles.role (if the column exists)
--    Profiles whose role text matches one of the default role names get a row.
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'profiles'
      AND column_name  = 'role'
  ) THEN
    INSERT INTO public.user_roles (profile_id, role_id)
    SELECT p.id, r.id
    FROM   public.profiles p
    JOIN   public.roles    r ON r.name = p.role
    WHERE  p.role IS NOT NULL
    ON CONFLICT DO NOTHING;
  END IF;
END $$;
