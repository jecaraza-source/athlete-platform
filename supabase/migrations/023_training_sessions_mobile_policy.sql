-- =============================================================================
-- 023_training_sessions_mobile_policy.sql
--
-- Context
-- -------
-- Migration 000 enabled RLS on training_sessions and added a SELECT policy
-- for authenticated users.  It did NOT add an INSERT policy, which means
-- mobile clients (anon key + user JWT) cannot create training sessions even
-- though the training screen exposes that form to athletes.
--
-- This migration adds:
--   1. INSERT policy — athletes can insert sessions for their own athlete
--      record; staff/coaches can insert for any athlete.
--   2. DELETE policy — the athlete who owns the session or any staff member
--      can delete it (mirrors the web's delete-session-button behaviour).
--
-- NOTE: All other follow-up tables (medical_cases, nutrition_plans,
-- physio_cases, psychology_cases, athlete_attachments) already have the
-- necessary SELECT (and, where needed, INSERT) policies from migrations
-- 000, 003, and 012.  No changes are required for those tables.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Helper: inline check for staff-level roles
-- Reused in both INSERT and DELETE policies below.
-- ---------------------------------------------------------------------------

-- training_sessions: INSERT
-- ---------------------------------------------------------------------------
-- An authenticated user may insert a row when:
--   a) The athlete_id belongs to an athletes record that is linked to their
--      own profile (via athletes.profile_id OR athletes.email).
--   b) OR the user holds a staff-level role (super_admin, admin, coach, staff)
--      and can log sessions on behalf of any athlete.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Athletes and staff can insert training_sessions" ON public.training_sessions;

CREATE POLICY "Athletes and staff can insert training_sessions"
  ON public.training_sessions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- (a) Athlete inserting for their own record
    athlete_id IN (
      SELECT a.id
      FROM   public.athletes  a
      JOIN   public.profiles  p ON (
               p.id = a.profile_id
               OR (a.email IS NOT NULL AND p.email = a.email)
             )
      WHERE  p.auth_user_id = auth.uid()
    )
    OR
    -- (b) Staff / coach inserting for any athlete
    EXISTS (
      SELECT 1
      FROM   public.user_roles  ur
      JOIN   public.roles        r ON r.id = ur.role_id
      JOIN   public.profiles     p ON p.id = ur.profile_id
      WHERE  p.auth_user_id = auth.uid()
        AND  r.code IN ('super_admin', 'admin', 'coach', 'staff')
    )
  );

-- training_sessions: DELETE
-- ---------------------------------------------------------------------------
-- Allows the owning athlete or any staff member to delete a session.
-- The web's delete-session-button already uses supabaseAdmin so this policy
-- targets mobile clients exclusively, but defining it consistently keeps
-- the security model explicit.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Athletes and staff can delete training_sessions" ON public.training_sessions;

CREATE POLICY "Athletes and staff can delete training_sessions"
  ON public.training_sessions
  FOR DELETE
  TO authenticated
  USING (
    -- (a) The session belongs to the requesting athlete
    athlete_id IN (
      SELECT a.id
      FROM   public.athletes  a
      JOIN   public.profiles  p ON (
               p.id = a.profile_id
               OR (a.email IS NOT NULL AND p.email = a.email)
             )
      WHERE  p.auth_user_id = auth.uid()
    )
    OR
    -- (b) Staff / coach
    EXISTS (
      SELECT 1
      FROM   public.user_roles  ur
      JOIN   public.roles        r ON r.id = ur.role_id
      JOIN   public.profiles     p ON p.id = ur.profile_id
      WHERE  p.auth_user_id = auth.uid()
        AND  r.code IN ('super_admin', 'admin', 'coach', 'staff')
    )
  );
