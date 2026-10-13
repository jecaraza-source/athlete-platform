-- =============================================================================
-- 20260906000003_validate_psych_response_items.sql
-- Rejects response item codes not defined for the assessment's instrument.
--
-- This trigger is intentionally installed even while some instruments have no
-- seed data. Such instruments reject their responses individually; they do not
-- block valid responses for instruments with completed item definitions.
-- =============================================================================

CREATE OR REPLACE FUNCTION private.validate_psych_response_item()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_instrument_id uuid;
BEGIN
  SELECT instrument_id
  INTO v_instrument_id
  FROM public.psych_assessments
  WHERE id = NEW.assessment_id;

  IF v_instrument_id IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.psych_instrument_items
    WHERE instrument_id = v_instrument_id
      AND item_code = NEW.item_code
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = format('item_code %L is not defined for this instrument', NEW.item_code);
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.validate_psych_response_item() FROM PUBLIC;

DROP TRIGGER IF EXISTS validate_psych_response_item ON public.psych_responses;
CREATE TRIGGER validate_psych_response_item
  BEFORE INSERT ON public.psych_responses
  FOR EACH ROW
  EXECUTE FUNCTION private.validate_psych_response_item();
