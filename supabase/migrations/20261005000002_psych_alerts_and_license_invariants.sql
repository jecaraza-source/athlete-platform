-- Make automated alerts idempotent and derive each instrument's aggregate
-- licence state from its four auditable permission checks.

DELETE FROM public.psych_alerts AS duplicate
USING public.psych_alerts AS canonical
WHERE duplicate.assessment_id = canonical.assessment_id
  AND duplicate.alert_type = canonical.alert_type
  AND duplicate.created_at > canonical.created_at;

CREATE UNIQUE INDEX IF NOT EXISTS idx_psych_alerts_assessment_type
  ON public.psych_alerts (assessment_id, alert_type);
-- The project owner confirms that every clinical instrument in this catalogue
-- has authorization for use, digital reproduction, official scoring, and its
-- Spanish translation. Record that authorization at the permission level so
-- the derived aggregate status remains auditable after this migration.
INSERT INTO public.psych_instrument_license_checks (
  instrument_id,
  permission_type,
  status,
  notes,
  verified_by,
  verified_at
)
SELECT
  instrument.id,
  permission.permission_type,
  'licensed',
  'Autorizado por el proyecto: uso, reproducción digital, scoring oficial y traducción al español.',
  NULL,
  now()
FROM public.psych_instruments AS instrument
CROSS JOIN (
  VALUES
    ('instrument_use'),
    ('digital_reproduction'),
    ('official_scoring'),
    ('spanish_translation')
) AS permission(permission_type)
WHERE instrument.is_test_only = false
ON CONFLICT (instrument_id, permission_type) DO UPDATE
SET
  status = EXCLUDED.status,
  notes = EXCLUDED.notes,
  verified_by = EXCLUDED.verified_by,
  verified_at = EXCLUDED.verified_at,
  updated_at = now();

CREATE OR REPLACE FUNCTION private.sync_psych_instrument_license_status(
  p_instrument_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_status public.psych_license_status;
  v_verified_by uuid;
  v_verified_at timestamptz;
BEGIN
  SELECT
    CASE
      WHEN bool_or(check_row.status = 'denied') THEN 'denied'::public.psych_license_status
      WHEN count(*) = 4
        AND bool_and(check_row.status IN ('licensed', 'not_required')) THEN 'licensed'::public.psych_license_status
      ELSE 'pending_review'::public.psych_license_status
    END,
    (array_agg(check_row.verified_by ORDER BY check_row.verified_at DESC NULLS LAST))[1],
    max(check_row.verified_at)
  INTO v_status, v_verified_by, v_verified_at
  FROM public.psych_instrument_license_checks AS check_row
  WHERE check_row.instrument_id = p_instrument_id;

  UPDATE public.psych_instruments
  SET
    license_status = v_status,
    license_verified_by = CASE WHEN v_status = 'licensed' THEN v_verified_by ELSE NULL END,
    license_verified_at = CASE WHEN v_status = 'licensed' THEN v_verified_at ELSE NULL END
  WHERE id = p_instrument_id;
END;
$$;

CREATE OR REPLACE FUNCTION private.sync_psych_instrument_license_status_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  PERFORM private.sync_psych_instrument_license_status(COALESCE(NEW.instrument_id, OLD.instrument_id));
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS sync_psych_instrument_license_status
  ON public.psych_instrument_license_checks;
CREATE TRIGGER sync_psych_instrument_license_status
  AFTER INSERT OR UPDATE OR DELETE ON public.psych_instrument_license_checks
  FOR EACH ROW
  EXECUTE FUNCTION private.sync_psych_instrument_license_status_trigger();

SELECT private.sync_psych_instrument_license_status(id)
FROM public.psych_instruments;

REVOKE ALL ON FUNCTION private.sync_psych_instrument_license_status(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.sync_psych_instrument_license_status_trigger() FROM PUBLIC;
