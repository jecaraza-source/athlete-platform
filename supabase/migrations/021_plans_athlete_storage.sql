-- =============================================================================
-- 021_plans_athlete_storage.sql
-- Allows athletes to create signed URLs for plan PDF files that have been
-- published and assigned to them.
-- =============================================================================

DROP POLICY IF EXISTS "Athletes can read their plan files" ON storage.objects;
CREATE POLICY "Athletes can read their plan files"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'plans'
    AND EXISTS (
      SELECT 1
      FROM public.plans       pl
      JOIN public.athlete_plans ap ON ap.plan_id    = pl.id
      JOIN public.athletes       a  ON a.id          = ap.athlete_id
      WHERE pl.file_path = storage.objects.name   -- name = relative path inside the bucket
        AND pl.is_published = true
        AND (
          a.profile_id IN (
            SELECT id FROM public.profiles WHERE auth_user_id = auth.uid()
          )
          OR (a.email IS NOT NULL AND a.email = auth.email())
        )
    )
  );
