-- Enforce the scheduled availability window and expose a minimal published
-- history view for the authenticated athlete without reopening raw-table RLS.

CREATE OR REPLACE FUNCTION private.can_athlete_respond(
  p_assessment_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.psych_assessments a
    JOIN public.profiles p ON p.id = a.athlete_id
    WHERE a.id = p_assessment_id
      AND p.auth_user_id = auth.uid()
      AND a.status = 'pending'
      AND (a.scheduled_for IS NULL OR a.scheduled_for <= now())
  );
$$;

REVOKE ALL ON FUNCTION private.can_athlete_respond(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.can_athlete_respond(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_published_psychological_history()
RETURNS TABLE (
  id uuid,
  completed_at timestamptz,
  instrument_name text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT assessment.id, assessment.completed_at, instrument.name
  FROM public.psych_assessments AS assessment
  JOIN public.profiles AS athlete ON athlete.id = assessment.athlete_id
  JOIN public.psych_instruments AS instrument ON instrument.id = assessment.instrument_id
  WHERE athlete.auth_user_id = auth.uid()
    AND assessment.status = 'completed'
    AND assessment.published_to_athlete = true
    AND instrument.is_test_only = false
  ORDER BY assessment.completed_at DESC NULLS LAST;
$$;

REVOKE ALL ON FUNCTION public.get_published_psychological_history() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_published_psychological_history() TO authenticated;
