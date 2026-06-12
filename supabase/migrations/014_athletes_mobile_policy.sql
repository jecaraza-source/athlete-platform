-- =============================================================================
-- 014_athletes_mobile_policy.sql
-- Adds a SELECT policy on the athletes table so authenticated mobile clients
-- (anon key + user JWT) can read athlete records.
--
-- Previously the web platform queried athletes exclusively through
-- supabaseAdmin (service-role key), which bypasses RLS.
-- Mobile clients need an explicit SELECT policy.
-- =============================================================================

ALTER TABLE public.athletes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read athletes" ON public.athletes;
CREATE POLICY "Authenticated users can read athletes"
  ON public.athletes
  FOR SELECT
  TO authenticated
  USING (true);
