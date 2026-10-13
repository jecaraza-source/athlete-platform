ALTER TABLE public.psych_assessments
  ADD COLUMN IF NOT EXISTS scheduled_by uuid
    REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_psych_assessments_scheduled_by
  ON public.psych_assessments (scheduled_by);
