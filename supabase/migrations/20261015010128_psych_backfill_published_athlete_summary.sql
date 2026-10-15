-- Before athlete_summary existed, clinical_summary was the text published to
-- the athlete. Keep already-published results visible by copying that same
-- text into athlete_summary. Idempotent; only touches published rows.
UPDATE public.psych_assessments
SET athlete_summary = clinical_summary
WHERE published_to_athlete = true
  AND athlete_summary IS NULL
  AND clinical_summary IS NOT NULL;
