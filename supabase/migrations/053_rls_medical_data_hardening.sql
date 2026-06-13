-- =============================================================================
-- 053_rls_medical_data_hardening.sql
--
-- SECURITY FIX: Replace overly-permissive USING(true) SELECT policies on
-- tables that contain sensitive health and medical data.
--
-- Problem: The base schema (000_base_schema.sql) granted SELECT access to all
-- authenticated users on these tables via USING(true). An authenticated
-- athlete could call the Supabase API directly and read the psychology
-- sessions, physiotherapy notes, or nutrition data of any other athlete —
-- a direct HIPAA/GDPR violation.
--
-- Fix: Replace each USING(true) policy with a role-aware policy that allows:
--   a) Staff members with the relevant specialty role to read all records
--   b) Athletes to read only their own records (via athletes.profile_id)
--
-- Tables hardened in this migration:
--   injuries, athlete_notes,
--   nutrition_plans, nutrition_checkins,
--   physio_cases, physio_sessions,
--   psychology_cases, psychology_sessions,
--   training_sessions,
--   events, event_participants
--
-- All writes continue to go through supabaseAdmin (service role, bypasses RLS),
-- so no INSERT/UPDATE/DELETE policies are changed here.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Reusable inline macro: "is the current user a staff member?"
-- Used across multiple policies below. Must be inlined because PG does not
-- support parametrised policy functions without SECURITY DEFINER risks.
-- Staff roles: super_admin, admin, program_director, coach, medic, physio,
--              nutritionist, psychologist, event_coordinator
-- ---------------------------------------------------------------------------

-- ── injuries ────────────────────────────────────────────────────────────────
-- Previously: USING(true) — any authenticated user could read all injury records.
-- Now: athlete reads own injuries; medical staff reads all.
DROP POLICY IF EXISTS "Authenticated users can read injuries" ON public.injuries;

CREATE POLICY "Staff or own athlete can read injuries"
  ON public.injuries FOR SELECT TO authenticated
  USING (
    -- (a) The authenticated user IS the athlete who owns this injury record
    athlete_id IN (
      SELECT a.id
      FROM   public.athletes a
      JOIN   public.profiles p ON p.id = a.profile_id
      WHERE  p.auth_user_id = auth.uid()
    )
    OR
    -- (b) The user holds a staff-level role with medical/training access
    EXISTS (
      SELECT 1
      FROM   public.user_roles ur
      JOIN   public.roles       r ON r.id = ur.role_id
      JOIN   public.profiles    p ON p.id = ur.profile_id
      WHERE  p.auth_user_id = auth.uid()
        AND  r.code IN (
          'super_admin', 'admin', 'program_director',
          'coach', 'medic', 'physio', 'nutritionist', 'psychologist',
          'event_coordinator'
        )
    )
  );

-- ── athlete_notes ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated users can read athlete_notes" ON public.athlete_notes;

CREATE POLICY "Staff or own athlete can read athlete_notes"
  ON public.athlete_notes FOR SELECT TO authenticated
  USING (
    athlete_id IN (
      SELECT a.id FROM public.athletes a
      JOIN   public.profiles p ON p.id = a.profile_id
      WHERE  p.auth_user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN   public.roles    r ON r.id = ur.role_id
      JOIN   public.profiles p ON p.id = ur.profile_id
      WHERE  p.auth_user_id = auth.uid()
        AND  r.code IN (
          'super_admin', 'admin', 'program_director',
          'coach', 'medic', 'physio', 'nutritionist', 'psychologist',
          'event_coordinator'
        )
    )
  );

-- ── nutrition_plans ────────────────────────────────────────────────────────
-- Restricted to: nutritionist, super_admin, admin, program_director, coach
-- (coaches need to see nutrition plans to coordinate training)
DROP POLICY IF EXISTS "Authenticated users can read nutrition_plans" ON public.nutrition_plans;

CREATE POLICY "Nutrition staff or own athlete can read nutrition_plans"
  ON public.nutrition_plans FOR SELECT TO authenticated
  USING (
    athlete_id IN (
      SELECT a.id FROM public.athletes a
      JOIN   public.profiles p ON p.id = a.profile_id
      WHERE  p.auth_user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN   public.roles    r ON r.id = ur.role_id
      JOIN   public.profiles p ON p.id = ur.profile_id
      WHERE  p.auth_user_id = auth.uid()
        AND  r.code IN (
          'super_admin', 'admin', 'program_director',
          'coach', 'nutritionist', 'medic'
        )
    )
  );

-- ── nutrition_checkins ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated users can read nutrition_checkins" ON public.nutrition_checkins;

CREATE POLICY "Nutrition staff or own athlete can read nutrition_checkins"
  ON public.nutrition_checkins FOR SELECT TO authenticated
  USING (
    athlete_id IN (
      SELECT a.id FROM public.athletes a
      JOIN   public.profiles p ON p.id = a.profile_id
      WHERE  p.auth_user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN   public.roles    r ON r.id = ur.role_id
      JOIN   public.profiles p ON p.id = ur.profile_id
      WHERE  p.auth_user_id = auth.uid()
        AND  r.code IN (
          'super_admin', 'admin', 'program_director',
          'coach', 'nutritionist', 'medic'
        )
    )
  );

-- ── physio_cases ───────────────────────────────────────────────────────────
-- Restricted to: physio, medic, admins. Athletes can see their own cases.
DROP POLICY IF EXISTS "Authenticated users can read physio_cases" ON public.physio_cases;

CREATE POLICY "Physio staff or own athlete can read physio_cases"
  ON public.physio_cases FOR SELECT TO authenticated
  USING (
    athlete_id IN (
      SELECT a.id FROM public.athletes a
      JOIN   public.profiles p ON p.id = a.profile_id
      WHERE  p.auth_user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN   public.roles    r ON r.id = ur.role_id
      JOIN   public.profiles p ON p.id = ur.profile_id
      WHERE  p.auth_user_id = auth.uid()
        AND  r.code IN (
          'super_admin', 'admin', 'program_director',
          'physio', 'medic', 'coach'
        )
    )
  );

-- ── physio_sessions ────────────────────────────────────────────────────────
-- Restricted to: physio, medic, admins. Athletes can see their own case sessions.
DROP POLICY IF EXISTS "Authenticated users can read physio_sessions" ON public.physio_sessions;

CREATE POLICY "Physio staff or case athlete can read physio_sessions"
  ON public.physio_sessions FOR SELECT TO authenticated
  USING (
    -- The athlete who owns the parent physio_case can read its sessions
    physio_case_id IN (
      SELECT pc.id
      FROM   public.physio_cases pc
      JOIN   public.athletes     a  ON a.id  = pc.athlete_id
      JOIN   public.profiles     p  ON p.id  = a.profile_id
      WHERE  p.auth_user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN   public.roles    r ON r.id = ur.role_id
      JOIN   public.profiles p ON p.id = ur.profile_id
      WHERE  p.auth_user_id = auth.uid()
        AND  r.code IN (
          'super_admin', 'admin', 'program_director',
          'physio', 'medic', 'coach'
        )
    )
  );

-- ── psychology_cases ───────────────────────────────────────────────────────
-- MOST SENSITIVE: restricted to psychologist and admins only.
-- Athletes can see their own case (not other athletes').
DROP POLICY IF EXISTS "Authenticated users can read psychology_cases" ON public.psychology_cases;

CREATE POLICY "Psychologist or own athlete can read psychology_cases"
  ON public.psychology_cases FOR SELECT TO authenticated
  USING (
    athlete_id IN (
      SELECT a.id FROM public.athletes a
      JOIN   public.profiles p ON p.id = a.profile_id
      WHERE  p.auth_user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN   public.roles    r ON r.id = ur.role_id
      JOIN   public.profiles p ON p.id = ur.profile_id
      WHERE  p.auth_user_id = auth.uid()
        AND  r.code IN (
          'super_admin', 'admin', 'program_director',
          'psychologist'
        )
    )
  );

-- ── psychology_sessions ────────────────────────────────────────────────────
-- MOST SENSITIVE: contains session notes and mood/stress scores.
DROP POLICY IF EXISTS "Authenticated users can read psychology_sessions" ON public.psychology_sessions;

CREATE POLICY "Psychologist or case athlete can read psychology_sessions"
  ON public.psychology_sessions FOR SELECT TO authenticated
  USING (
    -- The athlete who owns the parent psychology_case can read their own sessions
    psychology_case_id IN (
      SELECT pc.id
      FROM   public.psychology_cases pc
      JOIN   public.athletes         a  ON a.id  = pc.athlete_id
      JOIN   public.profiles         p  ON p.id  = a.profile_id
      WHERE  p.auth_user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN   public.roles    r ON r.id = ur.role_id
      JOIN   public.profiles p ON p.id = ur.profile_id
      WHERE  p.auth_user_id = auth.uid()
        AND  r.code IN (
          'super_admin', 'admin', 'program_director',
          'psychologist'
        )
    )
  );

-- ── training_sessions ──────────────────────────────────────────────────────
-- Note: migrations 023 and 028 already added INSERT/UPDATE/DELETE policies.
-- Only the SELECT (from migration 000) was USING(true).
DROP POLICY IF EXISTS "Authenticated users can read training_sessions" ON public.training_sessions;

CREATE POLICY "Coach or own athlete can read training_sessions"
  ON public.training_sessions FOR SELECT TO authenticated
  USING (
    -- The athlete who owns the session
    athlete_id IN (
      SELECT a.id FROM public.athletes a
      JOIN   public.profiles p ON p.id = a.profile_id
      WHERE  p.auth_user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN   public.roles    r ON r.id = ur.role_id
      JOIN   public.profiles p ON p.id = ur.profile_id
      WHERE  p.auth_user_id = auth.uid()
        AND  r.code IN (
          'super_admin', 'admin', 'program_director',
          'coach', 'medic', 'physio', 'nutritionist', 'psychologist',
          'event_coordinator'
        )
    )
  );

-- ── events ─────────────────────────────────────────────────────────────────
-- Staff see all events (for planning). Athletes see only events they're in.
-- Note: migrations 025 already added INSERT/UPDATE policies for staff.
DROP POLICY IF EXISTS "Authenticated users can read events" ON public.events;

CREATE POLICY "Staff or participant can read events"
  ON public.events FOR SELECT TO authenticated
  USING (
    -- Staff with scheduling/management access see all events
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN   public.roles    r ON r.id = ur.role_id
      JOIN   public.profiles p ON p.id = ur.profile_id
      WHERE  p.auth_user_id = auth.uid()
        AND  r.code IN (
          'super_admin', 'admin', 'program_director',
          'coach', 'medic', 'physio', 'nutritionist', 'psychologist',
          'event_coordinator'
        )
    )
    OR
    -- Athletes can see events they are a registered participant of
    id IN (
      SELECT ep.event_id
      FROM   public.event_participants ep
      JOIN   public.athletes           a  ON a.id  = ep.participant_id
      JOIN   public.profiles           p  ON p.id  = a.profile_id
      WHERE  p.auth_user_id = auth.uid()
    )
  );

-- ── event_participants ─────────────────────────────────────────────────────
-- Staff see all participant records; athletes see only their own.
-- Note: migration 025 added a FOR ALL (write) policy for staff.
DROP POLICY IF EXISTS "Authenticated users can read event_participants" ON public.event_participants;

CREATE POLICY "Staff or own athlete can read event_participants"
  ON public.event_participants FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN   public.roles    r ON r.id = ur.role_id
      JOIN   public.profiles p ON p.id = ur.profile_id
      WHERE  p.auth_user_id = auth.uid()
        AND  r.code IN (
          'super_admin', 'admin', 'program_director',
          'coach', 'medic', 'physio', 'nutritionist', 'psychologist',
          'event_coordinator'
        )
    )
    OR
    participant_id IN (
      SELECT a.id FROM public.athletes a
      JOIN   public.profiles p ON p.id = a.profile_id
      WHERE  p.auth_user_id = auth.uid()
    )
  );
