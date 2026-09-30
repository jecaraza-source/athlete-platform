-- =============================================================================
-- 20260906000004_psych_instrument_licensing.sql
-- Licensing state for psychological instruments.
--
-- No clinical instrument is considered licensed without a documented review of
-- use, digital reproduction, official scoring, and Spanish translation rights.
-- =============================================================================

DO $$ BEGIN
  CREATE TYPE public.psych_license_status AS ENUM (
    'pending_review',
    'licensed',
    'not_required',
    'denied'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.psych_instruments
  ADD COLUMN IF NOT EXISTS license_status public.psych_license_status
    NOT NULL DEFAULT 'pending_review',
  ADD COLUMN IF NOT EXISTS license_notes text,
  ADD COLUMN IF NOT EXISTS license_verified_by uuid
    REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS license_verified_at timestamptz;

-- Existing catalogue rows have no verified permission package. New clinical
-- instruments should retain this default until their checks are documented.
UPDATE public.psych_instruments
SET license_status = 'pending_review',
    license_notes = COALESCE(
      license_notes,
      'Pending verification of use, digital reproduction, official scoring, and Spanish translation rights.'
    )
WHERE code IN (
  'CSAI-2', 'POMS', 'ACSI-28', 'SCAT', 'TOPS',
  'TAIS', 'SMS', 'ABQ', 'RESTQ-Sport'
);

COMMENT ON COLUMN public.psych_instruments.requires_license IS
  'Legacy indicator. license_status is the authoritative gate for assessment creation.';
COMMENT ON COLUMN public.psych_instruments.license_status IS
  'Overall licensing gate. Only licensed and not_required instruments may create assessments.';
