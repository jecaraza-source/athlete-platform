-- =============================================================================
-- 20260906000005_psych_instrument_license_checks.sql
-- Auditable status of the four permissions required for each instrument.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.psych_instrument_license_checks (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  instrument_id   uuid        NOT NULL REFERENCES public.psych_instruments(id) ON DELETE CASCADE,
  permission_type text        NOT NULL CHECK (permission_type IN (
                    'instrument_use',
                    'digital_reproduction',
                    'official_scoring',
                    'spanish_translation'
                  )),
  status          public.psych_license_status NOT NULL DEFAULT 'pending_review',
  notes           text,
  verified_by     uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  verified_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (instrument_id, permission_type)
);

CREATE INDEX IF NOT EXISTS idx_psych_instrument_license_checks_instrument
  ON public.psych_instrument_license_checks (instrument_id);

ALTER TABLE public.psych_instrument_license_checks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read psych instrument license checks"
  ON public.psych_instrument_license_checks;
CREATE POLICY "Authenticated users can read psych instrument license checks"
  ON public.psych_instrument_license_checks
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Mental health admins can insert psych instrument license checks"
  ON public.psych_instrument_license_checks;
CREATE POLICY "Mental health admins can insert psych instrument license checks"
  ON public.psych_instrument_license_checks
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      JOIN public.profiles p ON p.id = ur.profile_id
      WHERE p.auth_user_id = auth.uid()
        AND r.code = 'mental_health_admin'
    )
  );

DROP POLICY IF EXISTS "Mental health admins can update psych instrument license checks"
  ON public.psych_instrument_license_checks;
CREATE POLICY "Mental health admins can update psych instrument license checks"
  ON public.psych_instrument_license_checks
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      JOIN public.profiles p ON p.id = ur.profile_id
      WHERE p.auth_user_id = auth.uid()
        AND r.code = 'mental_health_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      JOIN public.profiles p ON p.id = ur.profile_id
      WHERE p.auth_user_id = auth.uid()
        AND r.code = 'mental_health_admin'
    )
  );
