-- Synchronize the overall instrument status from its four required permissions.
WITH status_summary AS (
  SELECT
    instrument.id,
    CASE
      WHEN bool_or(license_check.status = 'denied') THEN 'denied'::public.psych_license_status
      WHEN count(*) = 4
        AND bool_and(license_check.status IN ('licensed', 'not_required')) THEN 'licensed'::public.psych_license_status
      ELSE 'pending_review'::public.psych_license_status
    END AS license_status
  FROM public.psych_instruments AS instrument
  LEFT JOIN public.psych_instrument_license_checks AS license_check
    ON license_check.instrument_id = instrument.id
  GROUP BY instrument.id
)
UPDATE public.psych_instruments AS instrument
SET
  license_status = summary.license_status,
  license_verified_at = CASE WHEN summary.license_status = 'licensed' THEN COALESCE(instrument.license_verified_at, now()) ELSE NULL END,
  license_verified_by = CASE WHEN summary.license_status = 'licensed' THEN instrument.license_verified_by ELSE NULL END
FROM status_summary AS summary
WHERE instrument.id = summary.id;
