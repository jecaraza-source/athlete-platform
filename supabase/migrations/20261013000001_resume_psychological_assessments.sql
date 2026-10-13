-- Resume operations after the temporary pause. Existing results return to
-- athlete visibility only when they were previously published and now satisfy
-- the approved workflow. Historical records without a clinical summary remain
-- internal until a clinician reviews and approves an appropriate summary.

UPDATE public.psych_instruments
SET is_active = true
WHERE is_test_only = false;

UPDATE public.psych_assessments
SET published_to_athlete = true
WHERE status = 'approved'
  AND published_at IS NOT NULL
  AND published_by IS NOT NULL;

GRANT EXECUTE ON FUNCTION public.get_published_psychological_history()
  TO authenticated;
