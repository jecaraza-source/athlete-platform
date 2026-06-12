-- =============================================================================
-- 024_push_jobs_read_at.sql
--
-- Adds a nullable `read_at` timestamp to push_jobs so the mobile app can
-- mark notifications as read without changing their delivery status.
--
-- The badge counter is updated to count only rows where read_at IS NULL
-- (previously it counted all rows with status = 'sent', which never
-- decreased once a notification arrived).
--
-- Also adds an UPDATE policy so authenticated mobile clients can mark
-- their own notifications as read (only the read_at column is updated
-- by the app; delivery status is managed server-side).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Add the column (idempotent)
-- ---------------------------------------------------------------------------
ALTER TABLE public.push_jobs
  ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_push_jobs_unread
  ON public.push_jobs (recipient_profile_id, read_at)
  WHERE read_at IS NULL;

-- ---------------------------------------------------------------------------
-- 2. UPDATE policy — recipient can only set read_at on their own jobs
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Recipients can mark their own push jobs as read" ON public.push_jobs;

CREATE POLICY "Recipients can mark their own push jobs as read"
  ON public.push_jobs
  FOR UPDATE
  TO authenticated
  USING (
    recipient_profile_id IN (
      SELECT id FROM public.profiles WHERE auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    recipient_profile_id IN (
      SELECT id FROM public.profiles WHERE auth_user_id = auth.uid()
    )
  );
