-- =============================================================================
-- 012_athlete_attachments.sql
-- Gestión unificada de documentos y archivos adjuntos del expediente del atleta
-- Soporta diagnóstico inicial, seguimientos y vista consolidada del expediente.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Tabla principal de adjuntos
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.athlete_attachments (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Asociación principal
  athlete_id          UUID        NOT NULL REFERENCES public.athletes(id) ON DELETE CASCADE,

  -- Módulo y sección de origen
  -- module_name: diagnostic | medical | nutrition | physio | psychology | training
  -- section_name: sub-sección dentro del módulo (ej. "medico", "nutricion", etc.)
  module_name         TEXT        NOT NULL,
  section_name        TEXT,

  -- Registro de origen (UUID del caso, plan, sesión o sección de diagnóstico)
  related_record_id   UUID,

  -- Metadatos del archivo
  file_name_original  TEXT        NOT NULL,
  file_name_storage   TEXT        NOT NULL, -- nombre en storage (incluye timestamp para evitar colisiones)
  file_path           TEXT        NOT NULL, -- path completo en el bucket
  mime_type           TEXT        NOT NULL,
  file_extension      TEXT        NOT NULL,
  file_size           BIGINT      NOT NULL, -- bytes

  -- Contenido y descripción
  description         TEXT,

  -- Auditoría de creación
  uploaded_by         UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  uploaded_at         TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Auditoría de edición de descripción
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Auditoría de eliminación (baja lógica)
  deleted_by          UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  deleted_at          TIMESTAMPTZ,

  -- Estado
  is_active           BOOLEAN     NOT NULL DEFAULT true
);

-- ---------------------------------------------------------------------------
-- 2. Índices
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_aa_athlete_id
  ON public.athlete_attachments(athlete_id);

CREATE INDEX IF NOT EXISTS idx_aa_module
  ON public.athlete_attachments(athlete_id, module_name);

CREATE INDEX IF NOT EXISTS idx_aa_related_record
  ON public.athlete_attachments(related_record_id)
  WHERE related_record_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_aa_active
  ON public.athlete_attachments(athlete_id, is_active, uploaded_at DESC);

-- ---------------------------------------------------------------------------
-- 3. Row Level Security
-- ---------------------------------------------------------------------------

ALTER TABLE public.athlete_attachments ENABLE ROW LEVEL SECURITY;

-- Usuarios autenticados pueden leer adjuntos activos
CREATE POLICY "Authenticated read athlete_attachments"
  ON public.athlete_attachments
  FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Usuarios autenticados pueden insertar adjuntos (la validación real se hace
-- en el server action con assertPermission('edit_athletes'))
CREATE POLICY "Authenticated insert athlete_attachments"
  ON public.athlete_attachments
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Usuarios autenticados pueden actualizar (descripción y baja lógica)
-- El server action valida permisos antes de ejecutar
CREATE POLICY "Authenticated update athlete_attachments"
  ON public.athlete_attachments
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 4. Nota sobre storage
-- El bucket "athlete-files" es privado y debe crearse manualmente o mediante
-- el server action ensureBucket() al primer uso.
-- Path convention: athlete-files/{athlete_id}/{module_name}/{file_name_storage}
-- Ejemplos:
--   athlete-files/uuid/medical/1713000000000-laboratorio.pdf
--   athlete-files/uuid/nutrition/1713000000001-plan-alimentario.xlsx
--   athlete-files/uuid/physio/1713000000002-evaluacion-postural.jpg
-- ---------------------------------------------------------------------------
