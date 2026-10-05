-- =============================================================================
-- 057_psych_scores.sql
-- Interpreted subscale scores. Athlete access requires manual publication.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.psych_scores (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id       uuid        NOT NULL REFERENCES public.psych_assessments(id) ON DELETE CASCADE,
  subscale_code       text        NOT NULL,
  raw_score           numeric     NOT NULL,
  band                text,
  interpretation_text text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (assessment_id, subscale_code)
);

CREATE INDEX IF NOT EXISTS idx_psych_scores_assessment
  ON public.psych_scores (assessment_id);

ALTER TABLE public.psych_scores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Athletes can read published psych scores"
  ON public.psych_scores;
CREATE POLICY "Athletes can read published psych scores"
  ON public.psych_scores
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.psych_assessments assessment
      JOIN public.profiles athlete_profile ON athlete_profile.id = assessment.athlete_id
      WHERE assessment.id = psych_scores.assessment_id
        AND assessment.published_to_athlete = true
        AND athlete_profile.auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Mental health admins manage psych scores"
  ON public.psych_scores;
CREATE POLICY "Mental health admins manage psych scores"
  ON public.psych_scores
  FOR ALL
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
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      JOIN public.profiles p ON p.id = ur.profile_id
      WHERE p.auth_user_id = auth.uid()
        AND r.code = 'mental_health_admin'
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
        AND private.is_coach_of_athlete(
          (SELECT id FROM public.profiles WHERE auth_user_id = auth.uid()),
          assessment.athlete_id
        )
    )
  );
