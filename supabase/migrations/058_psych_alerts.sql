-- =============================================================================
-- 058_psych_alerts.sql
-- Psychological risk alerts and their acknowledgement lifecycle.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.psych_alerts (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id   uuid        NOT NULL REFERENCES public.psych_assessments(id) ON DELETE CASCADE,
  athlete_id      uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  alert_type      text        NOT NULL,
  severity        text        NOT NULL CHECK (severity IN ('low', 'medium', 'high')),
  status          text        NOT NULL DEFAULT 'open'
                                CHECK (status IN ('open', 'acknowledged', 'resolved')),
  acknowledged_by uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  resolved_at     timestamptz
);

CREATE INDEX IF NOT EXISTS idx_psych_alerts_status_severity
  ON public.psych_alerts (status, severity);

ALTER TABLE public.psych_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Mental health admins can read psych alerts"
  ON public.psych_alerts;
CREATE POLICY "Mental health admins can read psych alerts"
  ON public.psych_alerts
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

DROP POLICY IF EXISTS "Direction can read psych alerts"
  ON public.psych_alerts;
CREATE POLICY "Direction can read psych alerts"
  ON public.psych_alerts
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      JOIN public.profiles p ON p.id = ur.profile_id
      WHERE p.auth_user_id = auth.uid()
        AND r.code IN ('program_director', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "Coaches can read roster psych alerts"
  ON public.psych_alerts;
CREATE POLICY "Coaches can read roster psych alerts"
  ON public.psych_alerts
  FOR SELECT
  TO authenticated
  USING (
    private.is_coach_of_athlete(
      (SELECT id FROM public.profiles WHERE auth_user_id = auth.uid()),
      athlete_id
    )
  );

DROP POLICY IF EXISTS "Mental health admins can insert psych alerts"
  ON public.psych_alerts;
CREATE POLICY "Mental health admins can insert psych alerts"
  ON public.psych_alerts
  FOR INSERT
  TO authenticated
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

DROP POLICY IF EXISTS "Mental health and direction can update psych alerts"
  ON public.psych_alerts;
CREATE POLICY "Mental health and direction can update psych alerts"
  ON public.psych_alerts
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      JOIN public.profiles p ON p.id = ur.profile_id
      WHERE p.auth_user_id = auth.uid()
        AND r.code IN ('mental_health_admin', 'program_director')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      JOIN public.profiles p ON p.id = ur.profile_id
      WHERE p.auth_user_id = auth.uid()
        AND r.code IN ('mental_health_admin', 'program_director')
    )
  );
