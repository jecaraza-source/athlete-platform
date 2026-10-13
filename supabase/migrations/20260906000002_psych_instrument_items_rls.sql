-- =============================================================================
-- 20260906000002_psych_instrument_items_rls.sql
-- RLS for psychological instrument item definitions.
-- =============================================================================

ALTER TABLE public.psych_instrument_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read psych instrument items"
  ON public.psych_instrument_items;
CREATE POLICY "Authenticated users can read psych instrument items"
  ON public.psych_instrument_items
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Mental health admins can insert psych instrument items"
  ON public.psych_instrument_items;
CREATE POLICY "Mental health admins can insert psych instrument items"
  ON public.psych_instrument_items
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

DROP POLICY IF EXISTS "Mental health admins can update psych instrument items"
  ON public.psych_instrument_items;
CREATE POLICY "Mental health admins can update psych instrument items"
  ON public.psych_instrument_items
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
