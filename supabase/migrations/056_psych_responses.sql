-- =============================================================================
-- 056_psych_responses.sql
-- Raw item-level responses. These are never readable by athletes or coaches.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.psych_responses (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid        NOT NULL REFERENCES public.psych_assessments(id) ON DELETE CASCADE,
  item_code     text        NOT NULL,
  raw_value     text        NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (assessment_id, item_code)
);

ALTER TABLE public.psych_responses ENABLE ROW LEVEL SECURITY;
-- Assessment rows remain hidden from athletes until publication. This narrowly
-- scoped SECURITY DEFINER function therefore authorizes response submission
-- without granting them SELECT access to pending assessment metadata.
CREATE OR REPLACE FUNCTION private.can_athlete_respond(
  p_assessment_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.psych_assessments a
    JOIN public.profiles p ON p.id = a.athlete_id
    WHERE a.id = p_assessment_id
      AND p.auth_user_id = auth.uid()
      AND a.status = 'pending'
  );
$$;

REVOKE ALL ON FUNCTION private.can_athlete_respond(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.can_athlete_respond(uuid) TO authenticated;

DROP POLICY IF EXISTS "Mental health admins can read psych responses"
  ON public.psych_responses;
CREATE POLICY "Mental health admins can read psych responses"
  ON public.psych_responses
  FOR SELECT
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
  );

DROP POLICY IF EXISTS "Mental health admins can insert psych responses"
  ON public.psych_responses;
CREATE POLICY "Mental health admins can insert psych responses"
  ON public.psych_responses
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

DROP POLICY IF EXISTS "Athletes can submit own pending psych responses"
  ON public.psych_responses;
CREATE POLICY "Athletes can submit own pending psych responses"
  ON public.psych_responses
  FOR INSERT
  TO authenticated
  WITH CHECK (
    private.can_athlete_respond(assessment_id)
  );
