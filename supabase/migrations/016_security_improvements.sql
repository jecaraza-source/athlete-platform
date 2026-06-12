-- =============================================================================
-- 016_security_improvements.sql
-- Tightens two overly-permissive RLS policies identified in the security audit:
--
--   1. tickets UPDATE  — was USING(true)/WITH CHECK(true)
--                         → now restricted to: creator, assignee, or staff/admin
--
--   2. athletes SELECT — was USING(true) for all authenticated users
--                         → now: staff/admin/coach can see all athletes;
--                           athletes can only see their own record
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Helper: reusable inline function to check if the current user holds any of
-- the given role codes. Used in multiple policies below.
-- ---------------------------------------------------------------------------

-- TICKETS: UPDATE — restrict to owner, assignee, or staff
-- ---------------------------------------------------------------------------
-- Drop the existing permissive UPDATE policy from migration 013
DROP POLICY IF EXISTS "Authenticated users can update tickets" ON public.tickets;

-- New, role-aware UPDATE policy
CREATE POLICY "Ticket owner, assignee or staff can update"
  ON public.tickets
  FOR UPDATE
  TO authenticated
  USING (
    -- 1. The user created the ticket
    created_by IN (
      SELECT id FROM public.profiles WHERE auth_user_id = auth.uid()
    )
    OR
    -- 2. The ticket is assigned to the user
    assigned_to IN (
      SELECT id FROM public.profiles WHERE auth_user_id = auth.uid()
    )
    OR
    -- 3. The user has a staff-level role (can manage any ticket)
    EXISTS (
      SELECT 1
      FROM public.user_roles  ur
      JOIN public.roles        r ON r.id = ur.role_id
      JOIN public.profiles     p ON p.id = ur.profile_id
      WHERE p.auth_user_id = auth.uid()
        AND r.code IN ('super_admin', 'admin', 'coach', 'staff')
    )
  )
  WITH CHECK (
    -- Mirror the USING clause so Postgres enforces both read and write sides
    created_by IN (
      SELECT id FROM public.profiles WHERE auth_user_id = auth.uid()
    )
    OR
    assigned_to IN (
      SELECT id FROM public.profiles WHERE auth_user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1
      FROM public.user_roles  ur
      JOIN public.roles        r ON r.id = ur.role_id
      JOIN public.profiles     p ON p.id = ur.profile_id
      WHERE p.auth_user_id = auth.uid()
        AND r.code IN ('super_admin', 'admin', 'coach', 'staff')
    )
  );

-- ---------------------------------------------------------------------------
-- ATHLETES: SELECT — replace the blanket USING(true) from migration 014
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can read athletes" ON public.athletes;

-- Staff, coaches, and admins can read ALL athlete records (needed for lists,
-- assignment, filtering, etc.).
CREATE POLICY "Staff and admins can read all athletes"
  ON public.athletes
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_roles  ur
      JOIN public.roles        r ON r.id = ur.role_id
      JOIN public.profiles     p ON p.id = ur.profile_id
      WHERE p.auth_user_id = auth.uid()
        AND r.code IN ('super_admin', 'admin', 'coach', 'staff')
    )
  );

-- Athletes can only read their own record (linked via profiles.id → athletes.profile_id)
CREATE POLICY "Athletes can read their own record"
  ON public.athletes
  FOR SELECT
  TO authenticated
  USING (
    profile_id IN (
      SELECT id FROM public.profiles WHERE auth_user_id = auth.uid()
    )
  );
