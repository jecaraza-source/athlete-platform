-- =============================================================================
-- 027_extend_notification_insert_policy.sql
--
-- Replaces the staff-only INSERT policies from migration 026 with policies
-- that allow ANY authenticated user to queue push_jobs and email_jobs.
--
-- Reason: athletes need to send notifications to staff when creating tickets.
-- The existing SELECT policy already ensures users can only READ their own
-- notifications, so allowing broad INSERT is safe for an internal app.
-- =============================================================================

-- push_jobs: allow any authenticated user to queue a notification
DROP POLICY IF EXISTS "Staff can insert push_jobs"            ON public.push_jobs;
DROP POLICY IF EXISTS "Authenticated users can insert push_jobs" ON public.push_jobs;

CREATE POLICY "Authenticated users can insert push_jobs"
  ON public.push_jobs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- email_jobs: allow any authenticated user to queue an email notification
DROP POLICY IF EXISTS "Staff can insert email_jobs"            ON public.email_jobs;
DROP POLICY IF EXISTS "Authenticated users can insert email_jobs" ON public.email_jobs;

CREATE POLICY "Authenticated users can insert email_jobs"
  ON public.email_jobs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);
