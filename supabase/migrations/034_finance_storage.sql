-- =============================================================================
-- 034_finance_storage.sql
--
-- Bucket privado `finance-files` para comprobantes y adjuntos financieros.
-- Path convention:
--   finance-files/{expense_id}/{file_name_storage}
--
-- Políticas de storage.objects:
--   INSERT — usuarios con rol financiero pueden subir archivos
--   SELECT — usuarios con rol financiero pueden leer / crear signed URLs
--   DELETE — usuarios con rol financiero pueden eliminar
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Crear bucket (idempotente: INSERT ... ON CONFLICT DO NOTHING)
-- ---------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'finance-files',
  'finance-files',
  false,
  52428800,    -- 50 MB
  ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'text/csv',
    'text/plain'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2. INSERT policy — usuarios con rol financiero pueden subir comprobantes
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Finance roles can upload to finance-files" ON storage.objects;

CREATE POLICY "Finance roles can upload to finance-files"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'finance-files'
    AND EXISTS (
      SELECT 1
      FROM   public.user_roles  ur
      JOIN   public.roles        r ON r.id = ur.role_id
      JOIN   public.profiles     p ON p.id = ur.profile_id
      WHERE  p.auth_user_id = auth.uid()
        AND  r.code IN ('super_admin', 'admin', 'program_director', 'finance_admin')
    )
  );

-- ---------------------------------------------------------------------------
-- 3. SELECT policy — usuarios con rol financiero pueden leer / signed URLs
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Finance roles can read finance-files" ON storage.objects;

CREATE POLICY "Finance roles can read finance-files"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'finance-files'
    AND EXISTS (
      SELECT 1
      FROM   public.user_roles  ur
      JOIN   public.roles        r ON r.id = ur.role_id
      JOIN   public.profiles     p ON p.id = ur.profile_id
      WHERE  p.auth_user_id = auth.uid()
        AND  r.code IN ('super_admin', 'admin', 'program_director', 'finance_admin')
    )
  );

-- ---------------------------------------------------------------------------
-- 4. DELETE policy — usuarios con rol financiero pueden eliminar archivos
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Finance roles can delete finance-files" ON storage.objects;

CREATE POLICY "Finance roles can delete finance-files"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'finance-files'
    AND EXISTS (
      SELECT 1
      FROM   public.user_roles  ur
      JOIN   public.roles        r ON r.id = ur.role_id
      JOIN   public.profiles     p ON p.id = ur.profile_id
      WHERE  p.auth_user_id = auth.uid()
        AND  r.code IN ('super_admin', 'admin', 'program_director', 'finance_admin')
    )
  );
