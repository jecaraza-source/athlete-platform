-- Clinical review is mandatory before an assessment can be published. Only
-- instruments with an implemented, validated policy may produce auto-scores.

ALTER TABLE public.psych_instruments
  ADD COLUMN IF NOT EXISTS scoring_mode text NOT NULL DEFAULT 'manual_review'
    CHECK (scoring_mode IN ('manual_review', 'automated'));

UPDATE public.psych_instruments
SET scoring_mode = CASE WHEN code = 'SCAT' THEN 'automated' ELSE 'manual_review' END;

ALTER TABLE public.psych_assessments
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS clinical_summary text,
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz;

ALTER TABLE public.psych_assessments
  DROP CONSTRAINT IF EXISTS psych_assessments_status_check;
ALTER TABLE public.psych_assessments
  ADD CONSTRAINT psych_assessments_status_check
    CHECK (status IN ('pending', 'completed', 'under_review', 'approved', 'expired'));
ALTER TABLE public.psych_assessments
  DROP CONSTRAINT IF EXISTS psych_assessments_check;

UPDATE public.psych_assessments
SET
  status = CASE WHEN published_to_athlete THEN 'approved' ELSE 'under_review' END,
  reviewed_by = CASE WHEN published_to_athlete THEN published_by ELSE reviewed_by END,
  reviewed_at = CASE WHEN published_to_athlete THEN published_at ELSE reviewed_at END,
  approved_by = CASE WHEN published_to_athlete THEN published_by ELSE approved_by END,
  approved_at = CASE WHEN published_to_athlete THEN published_at ELSE approved_at END
WHERE status = 'completed';

ALTER TABLE public.psych_assessments
  ADD CONSTRAINT psych_assessments_completed_at_check
    CHECK (completed_at IS NULL OR status IN ('completed', 'under_review', 'approved'));

CREATE INDEX IF NOT EXISTS idx_psych_assessments_review_status
  ON public.psych_assessments (status, completed_at DESC);
