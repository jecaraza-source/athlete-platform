-- The mobile athlete history can read only an approved, published clinical
-- summary. It never exposes answers, scores, bands, alerts, or review data.

DROP FUNCTION IF EXISTS public.get_published_psychological_history();

CREATE FUNCTION public.get_published_psychological_history()
RETURNS TABLE (
  id uuid,
  completed_at timestamptz,
  instrument_name text,
  clinical_summary text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT
    assessment.id,
    assessment.completed_at,
    instrument.name,
    assessment.clinical_summary
  FROM public.psych_assessments AS assessment
  JOIN public.profiles AS athlete ON athlete.id = assessment.athlete_id
  JOIN public.psych_instruments AS instrument ON instrument.id = assessment.instrument_id
  WHERE athlete.auth_user_id = auth.uid()
    AND assessment.status = 'approved'
    AND assessment.published_to_athlete = true
    AND assessment.clinical_summary IS NOT NULL
    AND instrument.is_test_only = false
  ORDER BY assessment.completed_at DESC NULLS LAST;
$$;

REVOKE ALL ON FUNCTION public.get_published_psychological_history() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_published_psychological_history() TO authenticated;
