-- =============================================================================
-- 026_mobile_notification_write_policies.sql
--
-- Grants staff-role users INSERT on push_jobs and email_jobs so the mobile
-- app can queue push / email notifications when creating events or tickets.
--
-- These jobs are picked up by the existing background processor on the web
-- server (service-role key) and dispatched via OneSignal / Resend.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- push_jobs: INSERT — staff can queue push notifications
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Staff can insert push_jobs" ON public.push_jobs;

CREATE POLICY "Staff can insert push_jobs"
  ON public.push_jobs
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

-- ---------------------------------------------------------------------------
-- email_jobs: INSERT — staff can queue email notifications
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Staff can insert email_jobs" ON public.email_jobs;

CREATE POLICY "Staff can insert email_jobs"
  ON public.email_jobs
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
