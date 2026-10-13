-- =============================================================================
-- 20260906000006_validate_psych_assessment_license.sql
-- Prevents creation of assessments for instruments without a cleared license.
-- =============================================================================

CREATE OR REPLACE FUNCTION private.validate_psych_assessment_license()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_license_status public.psych_license_status;
BEGIN
  SELECT license_status
  INTO v_license_status
  FROM public.psych_instruments
  WHERE id = NEW.instrument_id;

  IF v_license_status IS NULL
    OR v_license_status NOT IN ('licensed', 'not_required') THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'instrument is not licensed for assessment creation';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.validate_psych_assessment_license() FROM PUBLIC;

DROP TRIGGER IF EXISTS validate_psych_assessment_license ON public.psych_assessments;
CREATE TRIGGER validate_psych_assessment_license
  BEFORE INSERT ON public.psych_assessments
  FOR EACH ROW
  EXECUTE FUNCTION private.validate_psych_assessment_license();
