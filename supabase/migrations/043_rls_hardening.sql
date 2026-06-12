-- =============================================================================
-- 043_rls_hardening.sql
-- Closes two publicly-accessible tables flagged by the Supabase security advisor:
--
--   1. public.sports  — created outside the migration system (no prior DDL).
--                       This migration creates it if missing, enables RLS, and
--                       adds read access for all authenticated users.
--                       All writes go through supabaseAdmin (service role,
--                       bypasses RLS) so no write policies are needed here.
--
--   2. public.roles   — ENABLE ROW LEVEL SECURITY only existed in 001_rbac.sql,
--                       which is intentionally skipped on the production DB
--                       (serial-integer PK conflict). This migration ensures the
--                       flag is set idempotently and a read policy exists.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. sports
--    Lookup / catalogue table for disciplines. Queried by the calendar page
--    and the admin disciplines page. All mutations use supabaseAdmin.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.sports (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text        UNIQUE NOT NULL,
  category_type text        NOT NULL DEFAULT 'individual',
  status        text        NOT NULL DEFAULT 'active',
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sports_status ON public.sports(status);

ALTER TABLE public.sports ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read the sports catalogue.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'sports'
      AND policyname = 'Authenticated users can read sports'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Authenticated users can read sports"
        ON public.sports
        FOR SELECT
        TO authenticated
        USING (true)
    $policy$;
  END IF;
END$$;

-- ---------------------------------------------------------------------------
-- 2. roles
--    Ensure RLS is enabled (idempotent — ALTER TABLE ... ENABLE is safe to
--    run even if already enabled). Then ensure a read policy exists.
-- ---------------------------------------------------------------------------

ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'roles'
      AND policyname = 'Authenticated users can read roles'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Authenticated users can read roles"
        ON public.roles
        FOR SELECT
        TO authenticated
        USING (true)
    $policy$;
  END IF;
END$$;
