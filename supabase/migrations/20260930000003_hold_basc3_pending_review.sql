-- BASC-3 cannot be scheduled until its official compatible form, validity
-- indices, norm tables, and approved scoring integration are available.
UPDATE public.psych_instrument_license_checks AS license_check
SET
  status = 'pending_review',
  notes = 'Pendiente: requiere forma BASC-3 oficial identificada, baremos, índices de validez y scoring aprobado con manual o Q-global.',
  verified_by = NULL,
  verified_at = NULL,
  updated_at = now()
FROM public.psych_instruments AS instrument
WHERE license_check.instrument_id = instrument.id
  AND instrument.code = 'BASC-3-PRS-C';

UPDATE public.psych_instruments
SET
  is_active = false,
  license_status = 'pending_review',
  license_notes = 'No disponible para programación: faltan forma BASC-3 oficial compatible, normas, índices de validez y scoring del manual o Q-global.',
  license_verified_by = NULL,
  license_verified_at = NULL
WHERE code = 'BASC-3-PRS-C';
