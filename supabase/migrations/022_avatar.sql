-- =============================================================================
-- Migration 022 — Profile photo (avatar) support
-- =============================================================================
-- Run this migration in:
--   1. Supabase SQL Editor (Dashboard → SQL Editor)
--   2. Or via Supabase CLI: supabase db push
--
-- What this migration does:
--   a) Adds avatar_url column to profiles
--   b) Creates the 'avatars' storage bucket (public, 5 MB limit)
--   c) Adds RLS storage policies so each user can manage their own avatar
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Add avatar_url to profiles
-- ---------------------------------------------------------------------------

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS avatar_url TEXT DEFAULT NULL;

-- ---------------------------------------------------------------------------
-- 2. Create the avatars bucket
--    Files live at: avatars/{auth_user_id}/avatar.{ext}
--    The bucket is PUBLIC so avatar URLs are accessible without signed URLs.
-- ---------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  5242880,  -- 5 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 3. Storage RLS policies
--
--    Storage path format: avatars/{auth.uid()}/avatar.{ext}
--    The first folder segment (foldername[1]) equals the auth user's UUID.
-- ---------------------------------------------------------------------------

-- Allow authenticated users to UPLOAD their own avatar
CREATE POLICY "Users can upload their own avatar"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated users to UPDATE (replace) their own avatar
CREATE POLICY "Users can update their own avatar"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated users to DELETE their own avatar
CREATE POLICY "Users can delete their own avatar"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Public bucket: no SELECT policy needed — all reads go through the public URL
-- (storage/v1/object/public/avatars/...) without any auth check.
