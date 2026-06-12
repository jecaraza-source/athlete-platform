-- =============================================================================
-- 017_protocols.sql
-- Protocols PDF storage system.
--
-- Creates:
--   1. public.protocols       — one row per discipline, tracks current PDF
--   2. storage bucket         — 'protocols' (private, PDF only, max 50 MB)
--   3. RLS policies           — all authenticated users can read;
--                               only super_admin / admin can write
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. protocols table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.protocols (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  discipline    text        NOT NULL UNIQUE
                            CHECK (discipline IN ('coach','physio','medic','nutrition','psychology')),
  title         text,
  version       text,
  file_path     text        NOT NULL,   -- storage path: {discipline}/{uuid}.pdf
  file_name     text        NOT NULL,   -- original filename shown to users
  file_size     bigint,                 -- bytes
  uploaded_by   uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.protocols IS
  'Stores one PDF protocol per discipline. New uploads replace the previous file.';

-- RLS
ALTER TABLE public.protocols ENABLE ROW LEVEL SECURITY;

-- Any authenticated user (staff or athlete) can read protocols
DROP POLICY IF EXISTS "Authenticated users can read protocols" ON public.protocols;
CREATE POLICY "Authenticated users can read protocols"
  ON public.protocols
  FOR SELECT
  TO authenticated
  USING (true);

-- Only super_admin / admin can insert, update or delete
DROP POLICY IF EXISTS "Admins can manage protocols" ON public.protocols;
CREATE POLICY "Admins can manage protocols"
  ON public.protocols
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_roles  ur
      JOIN public.roles        r ON r.id = ur.role_id
      JOIN public.profiles     p ON p.id = ur.profile_id
      WHERE p.auth_user_id = auth.uid()
        AND r.code IN ('super_admin', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.user_roles  ur
      JOIN public.roles        r ON r.id = ur.role_id
      JOIN public.profiles     p ON p.id = ur.profile_id
      WHERE p.auth_user_id = auth.uid()
        AND r.code IN ('super_admin', 'admin')
    )
  );

-- ---------------------------------------------------------------------------
-- 2. Supabase Storage bucket
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'protocols',
  'protocols',
  false,           -- private: signed URLs required
  52428800,        -- 50 MB
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 3. Storage object policies
-- ---------------------------------------------------------------------------

-- All authenticated users can read/download protocol files (via signed URL)
DROP POLICY IF EXISTS "Authenticated users can read protocol files" ON storage.objects;
CREATE POLICY "Authenticated users can read protocol files"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'protocols');

-- Only admins can upload new protocol files
DROP POLICY IF EXISTS "Admins can upload protocol files" ON storage.objects;
CREATE POLICY "Admins can upload protocol files"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'protocols'
    AND EXISTS (
      SELECT 1
      FROM public.user_roles  ur
      JOIN public.roles        r ON r.id = ur.role_id
      JOIN public.profiles     p ON p.id = ur.profile_id
      WHERE p.auth_user_id = auth.uid()
        AND r.code IN ('super_admin', 'admin')
    )
  );

-- Only admins can delete protocol files
DROP POLICY IF EXISTS "Admins can delete protocol files" ON storage.objects;
CREATE POLICY "Admins can delete protocol files"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'protocols'
    AND EXISTS (
      SELECT 1
      FROM public.user_roles  ur
      JOIN public.roles        r ON r.id = ur.role_id
      JOIN public.profiles     p ON p.id = ur.profile_id
      WHERE p.auth_user_id = auth.uid()
        AND r.code IN ('super_admin', 'admin')
    )
  );
