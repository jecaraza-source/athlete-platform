-- Closes two read paths that bypassed the clinical review workflow when the
-- tables are queried directly through the Supabase REST API with a user JWT.
--
-- 1. psych_instrument_items holds licensed item text and the scoring key
--    (subscale_code, is_reverse_scored). Athletes receive their pending
--    questionnaire through the server routes, so direct reads are limited to
--    mental health administrators.
-- 2. Coaches may read roster assessments and scores only once a professional
--    has approved them; pending and under-review results stay clinical-only.

DROP POLICY IF EXISTS "Authenticated users can read psych instrument items"
  ON public.psych_instrument_items;
DROP POLICY IF EXISTS "Mental health admins can read psych instrument items"
  ON public.psych_instrument_items;
CREATE POLICY "Mental health admins can read psych instrument items"
  ON public.psych_instrument_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      JOIN public.profiles p ON p.id = ur.profile_id
      WHERE p.auth_user_id = auth.uid()
        AND r.code = 'mental_health_admin'
    )
  );

DROP POLICY IF EXISTS "Coaches can read roster psych assessments"
  ON public.psych_assessments;
CREATE POLICY "Coaches can read roster psych assessments"
  ON public.psych_assessments
  FOR SELECT
  TO authenticated
  USING (
    status = 'approved'
    AND private.is_coach_of_athlete(
      (SELECT id FROM public.profiles WHERE auth_user_id = auth.uid()),
      athlete_id
    )
  );

DROP POLICY IF EXISTS "Coaches can read roster psych scores"
  ON public.psych_scores;
CREATE POLICY "Coaches can read roster psych scores"
  ON public.psych_scores
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.psych_assessments assessment
      WHERE assessment.id = psych_scores.assessment_id
        AND assessment.status = 'approved'
        AND private.is_coach_of_athlete(
          (SELECT id FROM public.profiles WHERE auth_user_id = auth.uid()),
          assessment.athlete_id
        )
    )
  );
