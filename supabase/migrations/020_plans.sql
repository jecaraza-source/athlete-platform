-- =============================================================================
-- 020_plans.sql
-- Plans system: personalized plans per discipline for athletes.
--
-- Creates:
--   1. public.plans             — one row per plan (medical/nutrition/etc.)
--   2. public.athlete_plans     — many-to-many: plan ↔ athlete assignments
--   3. storage bucket           — 'plans' (private, PDF only, max 50 MB)
--   4. RLS policies             — authenticated users can read published plans
--                                 for their athlete record; staff/admin manage all
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. plans table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.plans (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  type          text        NOT NULL
                            CHECK (type IN ('medical','nutrition','psychology','training','rehabilitation')),
  title         text        NOT NULL,
  description   text,
  notes         text,
  file_path     text,                   -- storage path: {type}/{uuid}.pdf
  file_name     text,                   -- original filename shown to users
  file_size     bigint,                 -- bytes
  is_published  boolean     NOT NULL DEFAULT false,
  uploaded_by   uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.plans IS
  'Personalized plans per discipline (medical, nutrition, psychology, training, rehabilitation).';

ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

-- Staff and admins can read all plans
DROP POLICY IF EXISTS "Staff can read all plans" ON public.plans;
CREATE POLICY "Staff can read all plans"
  ON public.plans FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_roles  ur
      JOIN public.roles        r ON r.id = ur.role_id
      JOIN public.profiles     p ON p.id = ur.profile_id
      WHERE p.auth_user_id = auth.uid()
        AND r.code IN ('super_admin', 'admin', 'program_director',
                       'trainer', 'nutritionist', 'physio', 'psychologist', 'medic')
    )
  );

-- Only admins and staff can insert/update/delete plans
DROP POLICY IF EXISTS "Staff can manage plans" ON public.plans;
CREATE POLICY "Staff can manage plans"
  ON public.plans FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_roles  ur
      JOIN public.roles        r ON r.id = ur.role_id
      JOIN public.profiles     p ON p.id = ur.profile_id
      WHERE p.auth_user_id = auth.uid()
        AND r.code IN ('super_admin', 'admin', 'program_director',
                       'trainer', 'nutritionist', 'physio', 'psychologist', 'medic')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.user_roles  ur
      JOIN public.roles        r ON r.id = ur.role_id
      JOIN public.profiles     p ON p.id = ur.profile_id
      WHERE p.auth_user_id = auth.uid()
        AND r.code IN ('super_admin', 'admin', 'program_director',
                       'trainer', 'nutritionist', 'physio', 'psychologist', 'medic')
    )
  );

-- ---------------------------------------------------------------------------
-- 2. athlete_plans join table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.athlete_plans (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id         uuid        NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  athlete_id      uuid        NOT NULL REFERENCES public.athletes(id) ON DELETE CASCADE,
  assignment_mode text        NOT NULL DEFAULT 'individual'
                              CHECK (assignment_mode IN ('individual', 'collective')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (plan_id, athlete_id)
);

COMMENT ON TABLE public.athlete_plans IS
  'Associates plans with specific athletes (individual or collective assignment).';

ALTER TABLE public.athlete_plans ENABLE ROW LEVEL SECURITY;

-- Staff/admin can manage all athlete_plans
DROP POLICY IF EXISTS "Staff can manage athlete_plans" ON public.athlete_plans;
CREATE POLICY "Staff can manage athlete_plans"
  ON public.athlete_plans FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_roles  ur
      JOIN public.roles        r ON r.id = ur.role_id
      JOIN public.profiles     p ON p.id = ur.profile_id
      WHERE p.auth_user_id = auth.uid()
        AND r.code IN ('super_admin', 'admin', 'program_director',
                       'trainer', 'nutritionist', 'physio', 'psychologist', 'medic')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.user_roles  ur
      JOIN public.roles        r ON r.id = ur.role_id
      JOIN public.profiles     p ON p.id = ur.profile_id
      WHERE p.auth_user_id = auth.uid()
        AND r.code IN ('super_admin', 'admin', 'program_director',
                       'trainer', 'nutritionist', 'physio', 'psychologist', 'medic')
    )
  );

-- Athletes can read published plans assigned to them (defined here because it
-- references athlete_plans which must exist first)
DROP POLICY IF EXISTS "Athletes can read their published plans" ON public.plans;
CREATE POLICY "Athletes can read their published plans"
  ON public.plans FOR SELECT TO authenticated
  USING (
    is_published = true
    AND EXISTS (
      SELECT 1
      FROM public.athlete_plans ap
      JOIN public.athletes       a ON a.id = ap.athlete_id
      WHERE ap.plan_id = plans.id
        AND (
          a.profile_id IN (SELECT id FROM public.profiles WHERE auth_user_id = auth.uid())
          OR (a.email IS NOT NULL AND a.email = auth.email())
        )
    )
  );

-- Athletes can read their own athlete_plans rows
DROP POLICY IF EXISTS "Athletes can read their own athlete_plans" ON public.athlete_plans;
CREATE POLICY "Athletes can read their own athlete_plans"
  ON public.athlete_plans FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.athletes a
      WHERE a.id = athlete_plans.athlete_id
        AND (
          a.profile_id IN (SELECT id FROM public.profiles WHERE auth_user_id = auth.uid())
          OR (a.email IS NOT NULL AND a.email = auth.email())
        )
    )
  );

-- ---------------------------------------------------------------------------
-- 3. Storage bucket
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'plans',
  'plans',
  false,           -- private: signed URLs required
  52428800,        -- 50 MB
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 4. Storage object policies
-- ---------------------------------------------------------------------------

-- Staff can read plan files (via signed URL)
DROP POLICY IF EXISTS "Staff can read plan files" ON storage.objects;
CREATE POLICY "Staff can read plan files"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'plans'
    AND EXISTS (
      SELECT 1
      FROM public.user_roles  ur
      JOIN public.roles        r ON r.id = ur.role_id
      JOIN public.profiles     p ON p.id = ur.profile_id
      WHERE p.auth_user_id = auth.uid()
        AND r.code IN ('super_admin', 'admin', 'program_director',
                       'trainer', 'nutritionist', 'physio', 'psychologist', 'medic')
    )
  );

-- Staff can upload plan files
DROP POLICY IF EXISTS "Staff can upload plan files" ON storage.objects;
CREATE POLICY "Staff can upload plan files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'plans'
    AND EXISTS (
      SELECT 1
      FROM public.user_roles  ur
      JOIN public.roles        r ON r.id = ur.role_id
      JOIN public.profiles     p ON p.id = ur.profile_id
      WHERE p.auth_user_id = auth.uid()
        AND r.code IN ('super_admin', 'admin', 'program_director',
                       'trainer', 'nutritionist', 'physio', 'psychologist', 'medic')
    )
  );

-- Staff can delete plan files
DROP POLICY IF EXISTS "Staff can delete plan files" ON storage.objects;
CREATE POLICY "Staff can delete plan files"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'plans'
    AND EXISTS (
      SELECT 1
      FROM public.user_roles  ur
      JOIN public.roles        r ON r.id = ur.role_id
      JOIN public.profiles     p ON p.id = ur.profile_id
      WHERE p.auth_user_id = auth.uid()
        AND r.code IN ('super_admin', 'admin', 'program_director',
                       'trainer', 'nutritionist', 'physio', 'psychologist', 'medic')
    )
  );
