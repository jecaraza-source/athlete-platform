-- =============================================================================
-- 015_push_jobs_mobile_policy.sql
-- Adds SELECT policies on push_jobs and push_device_tokens so authenticated
-- mobile clients (anon key + user JWT) can read their own data.
--
-- Previously the web platform read these tables exclusively through
-- supabaseAdmin (service-role key), which bypasses RLS.
-- Mobile clients use the anon key, so they need explicit SELECT policies.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- push_jobs: SELECT
--   A user may read only push_jobs addressed to their own profile.
--   The subquery resolves auth.uid() → profiles.id so the join is correct.
-- ---------------------------------------------------------------------------
ALTER TABLE public.push_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read their own push jobs" ON public.push_jobs;
CREATE POLICY "Users can read their own push jobs"
  ON public.push_jobs
  FOR SELECT
  TO authenticated
  USING (
    recipient_profile_id IN (
      SELECT id FROM public.profiles WHERE auth_user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- push_device_tokens: SELECT
--   A user may read only their own registered device tokens.
-- ---------------------------------------------------------------------------
ALTER TABLE public.push_device_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read their own device tokens" ON public.push_device_tokens;
CREATE POLICY "Users can read their own device tokens"
  ON public.push_device_tokens
  FOR SELECT
  TO authenticated
  USING (
    profile_id IN (
      SELECT id FROM public.profiles WHERE auth_user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- push_device_tokens: INSERT / UPDATE (upsert from mobile app)
--   Allow the owning user to register and update their device tokens.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can upsert their own device tokens" ON public.push_device_tokens;
CREATE POLICY "Users can upsert their own device tokens"
  ON public.push_device_tokens
  FOR ALL
  TO authenticated
  USING (
    profile_id IN (
      SELECT id FROM public.profiles WHERE auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    profile_id IN (
      SELECT id FROM public.profiles WHERE auth_user_id = auth.uid()
    )
  );
