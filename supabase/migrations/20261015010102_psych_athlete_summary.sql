-- Splits the clinical review into two texts:
--   clinical_summary  confidential note for the clinical team; never shown to
--                     the athlete.
--   athlete_summary   summary written for the athlete; shown only once the
--                     assessment is approved and published.
--
-- The mobile history RPC keeps its column names so installed apps keep
-- working, but its clinical_summary column now carries athlete_summary.

ALTER TABLE public.psych_assessments
  ADD COLUMN IF NOT EXISTS athlete_summary text;

COMMENT ON COLUMN public.psych_assessments.clinical_summary IS
  'Confidential clinical note. Visible only to mental health staff; never published to the athlete.';
COMMENT ON COLUMN public.psych_assessments.athlete_summary IS
  'Summary written for the athlete. Visible to the athlete once approved and published.';

CREATE OR REPLACE FUNCTION public.get_published_psychological_history()
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
    assessment.athlete_summary
  FROM public.psych_assessments AS assessment
  JOIN public.profiles AS athlete ON athlete.id = assessment.athlete_id
  JOIN public.psych_instruments AS instrument ON instrument.id = assessment.instrument_id
  WHERE athlete.auth_user_id = auth.uid()
    AND assessment.status = 'approved'
    AND assessment.published_to_athlete = true
    AND assessment.athlete_summary IS NOT NULL
    AND instrument.is_test_only = false
  ORDER BY assessment.completed_at DESC NULLS LAST;
$$;
