-- =============================================================================
-- 20260906000007_mark_test_only_psych_instruments.sql
-- Prevents generic test-only instruments from appearing in application views.
-- Test fixtures are marked only in isolated test environments.
-- =============================================================================

ALTER TABLE public.psych_instruments
  ADD COLUMN IF NOT EXISTS is_test_only boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.psych_instruments.is_test_only IS
  'Excludes non-clinical technical fixtures from all application catalogue and assessment views.';
