-- =============================================================================
-- 055_psych_assessments.sql
-- Scheduled and completed psychological instrument applications.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.psych_assessments (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id            uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  instrument_id         uuid        NOT NULL REFERENCES public.psych_instruments(id) ON DELETE RESTRICT,
  status                text        NOT NULL DEFAULT 'pending'
                                      CHECK (status IN ('pending', 'completed', 'expired')),
  context               text        NOT NULL DEFAULT 'scheduled'
                                      CHECK (context IN ('scheduled', 'pre_competition', 'manual')),
  competition_id        uuid,
  scheduled_for         timestamptz,
  completed_at          timestamptz,
  published_to_athlete  boolean     NOT NULL DEFAULT false,
  published_by          uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  published_at          timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  CHECK (completed_at IS NULL OR status = 'completed'),
  CHECK (
    NOT published_to_athlete
    OR (published_by IS NOT NULL AND published_at IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_psych_assessments_athlete_status_scheduled
  ON public.psych_assessments (athlete_id, status, scheduled_for);

ALTER TABLE public.psych_assessments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Athletes can read published psych assessments"
  ON public.psych_assessments;
CREATE POLICY "Athletes can read published psych assessments"
  ON public.psych_assessments
  FOR SELECT
  TO authenticated
  USING (
    published_to_athlete = true
    AND athlete_id IN (
      SELECT id FROM public.profiles WHERE auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Mental health admins manage psych assessments"
  ON public.psych_assessments;
CREATE POLICY "Mental health admins manage psych assessments"
  ON public.psych_assessments
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

DROP POLICY IF EXISTS "Coaches can read roster psych assessments"
  ON public.psych_assessments;
CREATE POLICY "Coaches can read roster psych assessments"
  ON public.psych_assessments
  FOR SELECT
  TO authenticated
  USING (
    private.is_coach_of_athlete(
      (SELECT id FROM public.profiles WHERE auth_user_id = auth.uid()),
      athlete_id
    )
  );
