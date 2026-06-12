-- ============================================================================
-- 050_prevent_duplicate_athletes.sql
-- ============================================================================
-- Previene creación de atletas duplicados y crea tabla de auditoría
--
-- Cambios:
--   1. Crea tabla de auditoría para consolidaciones
--   2. Añade constraint único para prevenir duplicados (nombre + apellido)
--   3. Crea función para logs de cambios
-- ============================================================================

-- ============================================================================
-- 1. Tabla de Auditoría para Consolidaciones de Atletas
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.athlete_consolidation_audit (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  primary_athlete_id uuid       NOT NULL REFERENCES public.athletes(id) ON DELETE CASCADE,
  duplicate_athlete_ids uuid[]  NOT NULL,
  consolidated_by_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  references_updated integer    NOT NULL DEFAULT 0,
  duplicates_deleted integer    NOT NULL DEFAULT 0,
  reason            text,
  consolidated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_athlete_consolidation_audit_primary 
  ON public.athlete_consolidation_audit(primary_athlete_id);

CREATE INDEX IF NOT EXISTS idx_athlete_consolidation_audit_consolidated_at 
  ON public.athlete_consolidation_audit(consolidated_at);

ALTER TABLE public.athlete_consolidation_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read athlete consolidation audit"
  ON public.athlete_consolidation_audit FOR SELECT TO authenticated USING (true);


-- ============================================================================
-- 2. Añadir Constraint Único para Prevenir Duplicados
-- ============================================================================
-- NOTA: Si ya existen duplicados, esta migración FALLARÁ.
-- En ese caso, ejecutar primero: consolidate_duplicate_athletes.py

ALTER TABLE public.athletes 
ADD CONSTRAINT athletes_first_name_last_name_unique 
UNIQUE (first_name, last_name);

COMMENT ON CONSTRAINT athletes_first_name_last_name_unique 
ON public.athletes IS 
'Previene duplicados de atletas por nombre completo. '
'Ejecutar consolidate_duplicate_athletes.py antes si existen duplicados.';


-- ============================================================================
-- 3. Función de Logs para Cambios de Atletas
-- ============================================================================

CREATE OR REPLACE FUNCTION public.log_athlete_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Opcional: implementar logs más detallados aquí
  -- Por ahora, simplemente permite que los cambios pasen
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- 4. Documentación
-- ============================================================================

COMMENT ON TABLE public.athlete_consolidation_audit IS
'Registro de auditoría para consolidaciones de atletas duplicados. '
'Usado para rastrear qué atletas fueron mezclados y cuándo.';

COMMENT ON COLUMN public.athlete_consolidation_audit.primary_athlete_id IS
'El ID del atleta principal que se conservó después de la consolidación.';

COMMENT ON COLUMN public.athlete_consolidation_audit.duplicate_athlete_ids IS
'Array de IDs de atletas duplicados que fueron consolidados.';

COMMENT ON COLUMN public.athlete_consolidation_audit.references_updated IS
'Número de referencias (training_sessions, nutrition_plans, etc.) que fueron redireccionadas.';

COMMENT ON COLUMN public.athlete_consolidation_audit.duplicates_deleted IS
'Número de registros de atletas duplicados que fueron eliminados.';

COMMENT ON COLUMN public.athlete_consolidation_audit.reason IS
'Razón de la consolidación (manual, automática, etc.).';
