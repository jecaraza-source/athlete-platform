-- =============================================================================
-- 20260720000001_activity_athletes_and_entregado.sql
--
-- Fase 1 — Puntos 2 y 3 del roadmap de reportes entregables:
--
-- Punto 3: Agregar a `activities` quién recibió el apoyo operativo
--   - atencion_entregado_a   → nombre de la persona que recibió la entrega
--   - atencion_entregado_rol → cargo / rol (ej. Entrenador, Médico…)
--
-- Punto 2: Crear tabla `activity_athletes`
--   Join table entre actividades y atletas (beneficiarios / población objetivo).
--   Reemplaza el campo entero `numero_participantes` con una relación real.
--
-- Seguro para ejecutar sobre datos existentes.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Punto 3 — campos en activities
-- ---------------------------------------------------------------------------
ALTER TABLE activities
  ADD COLUMN IF NOT EXISTS atencion_entregado_a   TEXT,
  ADD COLUMN IF NOT EXISTS atencion_entregado_rol TEXT;

COMMENT ON COLUMN activities.atencion_entregado_a
  IS 'Nombre de la persona que recibió el apoyo (entrenador, atleta, tutor…)';
COMMENT ON COLUMN activities.atencion_entregado_rol
  IS 'Cargo o rol de quien recibió el apoyo (ej. Entrenador, Médico de equipo)';

-- ---------------------------------------------------------------------------
-- 2. Punto 2 — tabla activity_athletes (beneficiarios por actividad)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.activity_athletes (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id UUID        NOT NULL REFERENCES activities(id)        ON DELETE CASCADE,
  athlete_id  UUID        NOT NULL REFERENCES public.athletes(id)   ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (activity_id, athlete_id)
);

CREATE INDEX IF NOT EXISTS idx_activity_athletes_activity
  ON public.activity_athletes (activity_id);

CREATE INDEX IF NOT EXISTS idx_activity_athletes_athlete
  ON public.activity_athletes (athlete_id);

-- RLS: solo staff autenticado puede leer; solo admin puede escribir
ALTER TABLE public.activity_athletes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read activity_athletes"
  ON public.activity_athletes FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin insert activity_athletes"
  ON public.activity_athletes FOR INSERT TO authenticated
  WITH CHECK (true);  -- control real en Server Actions (assertAdminAccess)

CREATE POLICY "Admin delete activity_athletes"
  ON public.activity_athletes FOR DELETE TO authenticated
  USING (true);       -- control real en Server Actions

COMMENT ON TABLE public.activity_athletes
  IS 'Relación actividad ↔ atleta beneficiario. Permite generar la Base de Datos de Beneficiarios de cada reporte entregable.';
