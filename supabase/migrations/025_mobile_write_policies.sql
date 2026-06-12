-- =============================================================================
-- 025_mobile_write_policies.sql
--
-- Adds INSERT / UPDATE policies needed for mobile write operations introduced
-- in Priority 4:
--
--   [O11] Staff can create and update calendar events / participants
--   [O7]  Staff can create and update athlete diagnostics / sections
--   [O8]  Enable Supabase Realtime on tickets and push_jobs tables so mobile
--         clients receive live INSERT/UPDATE notifications without polling.
--
-- All write policies require the caller to hold a staff-level role
-- (super_admin, admin, coach, staff, program_director) to prevent athletes
-- from modifying records they don't own.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Helper: reusable inline check used across multiple policies
-- ---------------------------------------------------------------------------

-- [O11] events: INSERT — staff can create events
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Staff can insert events" ON public.events;

CREATE POLICY "Staff can insert events"
  ON public.events
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM   public.user_roles  ur
      JOIN   public.roles        r ON r.id = ur.role_id
      JOIN   public.profiles     p ON p.id = ur.profile_id
      WHERE  p.auth_user_id = auth.uid()
        AND  r.code IN ('super_admin', 'admin', 'coach', 'staff', 'program_director')
    )
  );

-- [O11] events: UPDATE — creator or staff
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Creator or staff can update events" ON public.events;

CREATE POLICY "Creator or staff can update events"
  ON public.events
  FOR UPDATE
  TO authenticated
  USING (
    created_by_profile_id IN (
      SELECT id FROM public.profiles WHERE auth_user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM   public.user_roles  ur
      JOIN   public.roles        r ON r.id = ur.role_id
      JOIN   public.profiles     p ON p.id = ur.profile_id
      WHERE  p.auth_user_id = auth.uid()
        AND  r.code IN ('super_admin', 'admin', 'coach', 'staff', 'program_director')
    )
  );

-- [O11] event_participants: INSERT/DELETE — staff can manage participants
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Staff can manage event_participants" ON public.event_participants;

CREATE POLICY "Staff can manage event_participants"
  ON public.event_participants
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM   public.user_roles  ur
      JOIN   public.roles        r ON r.id = ur.role_id
      JOIN   public.profiles     p ON p.id = ur.profile_id
      WHERE  p.auth_user_id = auth.uid()
        AND  r.code IN ('super_admin', 'admin', 'coach', 'staff', 'program_director')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM   public.user_roles  ur
      JOIN   public.roles        r ON r.id = ur.role_id
      JOIN   public.profiles     p ON p.id = ur.profile_id
      WHERE  p.auth_user_id = auth.uid()
        AND  r.code IN ('super_admin', 'admin', 'coach', 'staff', 'program_director')
    )
  );

-- [O7] athlete_initial_diagnostic: INSERT / UPDATE — staff only
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Staff can insert athlete_initial_diagnostic" ON public.athlete_initial_diagnostic;
DROP POLICY IF EXISTS "Staff can update athlete_initial_diagnostic" ON public.athlete_initial_diagnostic;

CREATE POLICY "Staff can insert athlete_initial_diagnostic"
  ON public.athlete_initial_diagnostic
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM   public.user_roles  ur
      JOIN   public.roles        r ON r.id = ur.role_id
      JOIN   public.profiles     p ON p.id = ur.profile_id
      WHERE  p.auth_user_id = auth.uid()
        AND  r.code IN ('super_admin', 'admin', 'coach', 'staff', 'program_director')
    )
  );

CREATE POLICY "Staff can update athlete_initial_diagnostic"
  ON public.athlete_initial_diagnostic
  FOR UPDATE
  TO authenticated
  USING (true)   -- any authenticated staff user may update any diagnostic
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM   public.user_roles  ur
      JOIN   public.roles        r ON r.id = ur.role_id
      JOIN   public.profiles     p ON p.id = ur.profile_id
      WHERE  p.auth_user_id = auth.uid()
        AND  r.code IN ('super_admin', 'admin', 'coach', 'staff', 'program_director')
    )
  );

-- [O7] athlete_diagnostic_sections: INSERT / UPDATE — staff only
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Staff can insert athlete_diagnostic_sections" ON public.athlete_diagnostic_sections;
DROP POLICY IF EXISTS "Staff can update athlete_diagnostic_sections" ON public.athlete_diagnostic_sections;

CREATE POLICY "Staff can insert athlete_diagnostic_sections"
  ON public.athlete_diagnostic_sections
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM   public.user_roles  ur
      JOIN   public.roles        r ON r.id = ur.role_id
      JOIN   public.profiles     p ON p.id = ur.profile_id
      WHERE  p.auth_user_id = auth.uid()
        AND  r.code IN ('super_admin', 'admin', 'coach', 'staff', 'program_director')
    )
  );

CREATE POLICY "Staff can update athlete_diagnostic_sections"
  ON public.athlete_diagnostic_sections
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM   public.user_roles  ur
      JOIN   public.roles        r ON r.id = ur.role_id
      JOIN   public.profiles     p ON p.id = ur.profile_id
      WHERE  p.auth_user_id = auth.uid()
        AND  r.code IN ('super_admin', 'admin', 'coach', 'staff', 'program_director')
    )
  );

-- [O8] Supabase Realtime — enable on tables used for live updates
-- ---------------------------------------------------------------------------
-- Realtime must be explicitly added to the supabase_realtime publication.
-- Adding a table that is already in the publication is a no-op.
ALTER PUBLICATION supabase_realtime ADD TABLE public.tickets;
ALTER PUBLICATION supabase_realtime ADD TABLE public.push_jobs;
