-- =============================================================================
-- 026_athlete_files_storage.sql
--
-- Context
-- -------
-- The athlete-files storage bucket is private but had no RLS policies on
-- storage.objects, so any INSERT from a mobile client (anon key + user JWT)
-- was rejected with "new row violates row-level security policy".
--
-- File path convention used by the mobile app:
--   athlete-files/athletes/{athlete_id}/{filename}          (seguimiento)
--   athlete-files/athletes/{athlete_id}/training/{filename} (training sessions)
--
-- This migration adds:
--   1. INSERT policy — athletes can upload into their own athlete folder;
--      staff can upload into any athlete folder.
--   2. SELECT policy — athletes can read (and create signed URLs for) their
--      own files; staff can read any file in the bucket.
-- =============================================================================

-- ── INSERT: athletes upload to their own folder ───────────────────────────
DROP POLICY IF EXISTS "Athletes can upload to their own athlete folder" ON storage.objects;

CREATE POLICY "Athletes can upload to their own athlete folder"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'athlete-files'
    AND (storage.foldername(name))[1] = 'athletes'
    AND (storage.foldername(name))[2] IN (
      SELECT a.id::text
      FROM   public.athletes a
      JOIN   public.profiles p ON (
               p.id = a.profile_id
               OR (a.email IS NOT NULL AND p.email = a.email)
             )
      WHERE  p.auth_user_id = auth.uid()
    )
  );

-- ── INSERT: staff/coaches upload to any athlete folder ───────────────────
DROP POLICY IF EXISTS "Staff can upload to athlete-files" ON storage.objects;

CREATE POLICY "Staff can upload to athlete-files"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'athlete-files'
    AND EXISTS (
      SELECT 1
      FROM   public.user_roles  ur
      JOIN   public.roles        r ON r.id = ur.role_id
      JOIN   public.profiles     p ON p.id = ur.profile_id
      WHERE  p.auth_user_id = auth.uid()
        AND  r.code IN ('super_admin', 'admin', 'coach', 'staff', 'program_director')
    )
  );

-- ── SELECT: athletes can read/sign their own files ───────────────────────
DROP POLICY IF EXISTS "Athletes can read their own athlete files" ON storage.objects;

CREATE POLICY "Athletes can read their own athlete files"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'athlete-files'
    AND (storage.foldername(name))[1] = 'athletes'
    AND (storage.foldername(name))[2] IN (
      SELECT a.id::text
      FROM   public.athletes a
      JOIN   public.profiles p ON (
               p.id = a.profile_id
               OR (a.email IS NOT NULL AND p.email = a.email)
             )
      WHERE  p.auth_user_id = auth.uid()
    )
  );

-- ── SELECT: staff can read any file in the bucket ────────────────────────
DROP POLICY IF EXISTS "Staff can read athlete-files" ON storage.objects;

CREATE POLICY "Staff can read athlete-files"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'athlete-files'
    AND EXISTS (
      SELECT 1
      FROM   public.user_roles  ur
      JOIN   public.roles        r ON r.id = ur.role_id
      JOIN   public.profiles     p ON p.id = ur.profile_id
      WHERE  p.auth_user_id = auth.uid()
        AND  r.code IN ('super_admin', 'admin', 'coach', 'staff', 'program_director')
    )
  );
