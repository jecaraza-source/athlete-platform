-- =============================================================================
-- 028_training_session_athlete_feedback.sql
--
-- Adds athlete-facing feedback fields to training_sessions:
--   athlete_comment  — athlete's note on the session
--   is_done          — whether the athlete marked the session as completed
--
-- Also adds RLS policies so athletes can update their own session feedback.
-- =============================================================================

ALTER TABLE public.training_sessions
  ADD COLUMN IF NOT EXISTS athlete_comment text,
  ADD COLUMN IF NOT EXISTS is_done         boolean NOT NULL DEFAULT false;

-- ---------------------------------------------------------------------------
-- Athletes can update feedback on their own sessions
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Athletes can update own session feedback" ON public.training_sessions;

CREATE POLICY "Athletes can update own session feedback"
  ON public.training_sessions
  FOR UPDATE
  TO authenticated
  USING (
    athlete_id IN (
      SELECT a.id
      FROM   public.athletes a
      JOIN   public.profiles p ON p.id = a.profile_id
      WHERE  p.auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    athlete_id IN (
      SELECT a.id
      FROM   public.athletes a
      JOIN   public.profiles p ON p.id = a.profile_id
      WHERE  p.auth_user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Staff can update any training session (e.g. to add coach notes)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Staff can update training sessions" ON public.training_sessions;

CREATE POLICY "Staff can update training sessions"
  ON public.training_sessions
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM   public.user_roles  ur
      JOIN   public.roles        r ON r.id = ur.role_id
      JOIN   public.profiles     p ON p.id = ur.profile_id
      WHERE  p.auth_user_id = auth.uid()
        AND  r.code IN ('super_admin', 'admin', 'coach', 'staff', 'program_director')
    )
  );
