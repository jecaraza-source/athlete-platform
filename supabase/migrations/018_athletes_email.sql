-- =============================================================================
-- 018_athletes_email.sql
-- Adds an email column to the athletes table so that athlete users can be
-- identified by their login email without requiring profile_id to be set.
--
-- The mobile app resolves the athlete record by matching athletes.email
-- against the authenticated user's email (auth.email()).
--
-- The RLS policy for athlete self-read is updated to support both:
--   (a) profile_id match (existing approach, still supported)
--   (b) email match     (new primary approach)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Add email column (safe — idempotent)
-- ---------------------------------------------------------------------------
ALTER TABLE public.athletes
  ADD COLUMN IF NOT EXISTS email text;

-- Partial unique index: only enforce uniqueness when email is not null
CREATE UNIQUE INDEX IF NOT EXISTS idx_athletes_email
  ON public.athletes(email)
  WHERE email IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 2. Update athlete self-read RLS policy
--    Replaces the policy from migration 016 to also allow email-based access.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Athletes can read their own record" ON public.athletes;

CREATE POLICY "Athletes can read their own record"
  ON public.athletes
  FOR SELECT
  TO authenticated
  USING (
    -- (a) Linked via profile_id (legacy / explicit link)
    profile_id IN (
      SELECT id FROM public.profiles WHERE auth_user_id = auth.uid()
    )
    OR
    -- (b) Matched by email — athlete's login email equals athletes.email
    (email IS NOT NULL AND email = auth.email())
  );
