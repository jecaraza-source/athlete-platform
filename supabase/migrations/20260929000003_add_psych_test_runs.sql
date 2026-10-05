-- Marks assessment executions used only to verify questionnaire behavior.
-- Test runs must never persist raw responses, scores, alerts, or publication.
ALTER TABLE public.psych_assessments
  ADD COLUMN IF NOT EXISTS is_test_run boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_psych_assessments_test_run
  ON public.psych_assessments (is_test_run)
  WHERE is_test_run = true;
