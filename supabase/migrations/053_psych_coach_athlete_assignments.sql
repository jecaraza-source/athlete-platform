-- =============================================================================
-- 053_psych_coach_athlete_assignments.sql
-- Persistent coach ↔ athlete roster used by psychological-profile RLS.
-- =============================================================================
-- Keep SECURITY DEFINER helpers out of PostgREST's default public schema.
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated;

CREATE TABLE IF NOT EXISTS public.psych_coach_athlete_assignments (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_profile_id    uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  athlete_profile_id  uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assigned_at         timestamptz NOT NULL DEFAULT now(),
  unassigned_at       timestamptz,
  assigned_by         uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  CHECK (coach_profile_id <> athlete_profile_id),
  CHECK (unassigned_at IS NULL OR unassigned_at >= assigned_at)
);

-- An athlete may have historical assignments, but only one active assignment
-- to the same coach at a time.
CREATE UNIQUE INDEX IF NOT EXISTS idx_psych_coach_athlete_assignments_active
  ON public.psych_coach_athlete_assignments (coach_profile_id, athlete_profile_id)
  WHERE unassigned_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_psych_coach_athlete_assignments_coach_active
  ON public.psych_coach_athlete_assignments (coach_profile_id)
  WHERE unassigned_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_psych_coach_athlete_assignments_athlete_active
  ON public.psych_coach_athlete_assignments (athlete_profile_id)
  WHERE unassigned_at IS NULL;

ALTER TABLE public.psych_coach_athlete_assignments ENABLE ROW LEVEL SECURITY;
-- Resolves active coach ownership without exposing roster rows through a
-- caller-controlled search_path or requiring the calling policy to join RBAC.
CREATE OR REPLACE FUNCTION private.is_coach_of_athlete(
  p_coach_id uuid,
  p_athlete_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.psych_coach_athlete_assignments assignment
    JOIN public.user_roles ur ON ur.profile_id = assignment.coach_profile_id
    JOIN public.roles r ON r.id = ur.role_id
    WHERE assignment.coach_profile_id = p_coach_id
      AND assignment.athlete_profile_id = p_athlete_id
      AND assignment.unassigned_at IS NULL
      AND r.code = 'coach'
  );
$$;

REVOKE ALL ON FUNCTION private.is_coach_of_athlete(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.is_coach_of_athlete(uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS "Coaches can read their psychological roster"
  ON public.psych_coach_athlete_assignments;
CREATE POLICY "Coaches can read their psychological roster"
  ON public.psych_coach_athlete_assignments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      JOIN public.profiles p ON p.id = ur.profile_id
      WHERE p.id = psych_coach_athlete_assignments.coach_profile_id
        AND p.auth_user_id = auth.uid()
        AND r.code = 'coach'
    )
  );

DROP POLICY IF EXISTS "Psych roster readable by direction"
  ON public.psych_coach_athlete_assignments;
CREATE POLICY "Psych roster readable by direction"
  ON public.psych_coach_athlete_assignments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      JOIN public.profiles p ON p.id = ur.profile_id
      WHERE p.auth_user_id = auth.uid()
        AND r.code IN ('super_admin', 'program_director')
    )
  );

DROP POLICY IF EXISTS "Psych roster managed by direction"
  ON public.psych_coach_athlete_assignments;
CREATE POLICY "Psych roster managed by direction"
  ON public.psych_coach_athlete_assignments
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      JOIN public.profiles p ON p.id = ur.profile_id
      WHERE p.auth_user_id = auth.uid()
        AND r.code IN ('super_admin', 'program_director')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      JOIN public.profiles p ON p.id = ur.profile_id
      WHERE p.auth_user_id = auth.uid()
        AND r.code IN ('super_admin', 'program_director')
    )
  );
