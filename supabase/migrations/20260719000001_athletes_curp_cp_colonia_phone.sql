-- =============================================================================
-- 20260719000001_athletes_curp_cp_colonia_phone.sql
--
-- Agrega campos demográficos requeridos para los reportes entregables:
--   Base de Datos de Beneficiarios, Bitácora Operativa y Ficha Técnica.
--
-- Fuente de datos: INTEGRADO_ATLETAS_POR_DISCIPLINA.xlsx (hoja CONSOLIDADO)
-- Script de importación: scripts/import_athlete_demographics.py
--
-- Seguro para ejecutar sobre datos existentes (ADD COLUMN IF NOT EXISTS).
-- =============================================================================

ALTER TABLE public.athletes
  ADD COLUMN IF NOT EXISTS curp    TEXT,
  ADD COLUMN IF NOT EXISTS cp      TEXT,   -- Código Postal (texto para conservar ceros iniciales)
  ADD COLUMN IF NOT EXISTS colonia TEXT,
  ADD COLUMN IF NOT EXISTS phone   TEXT;

-- Índice para búsquedas por CURP
-- NOTA: no se define como UNIQUE porque puede haber duplicados históricos en BD.
-- La unicidad se debe garantizar a nivel de aplicación al capturar nuevos registros.
CREATE INDEX IF NOT EXISTS idx_athletes_curp
  ON public.athletes (curp)
  WHERE curp IS NOT NULL;

COMMENT ON COLUMN public.athletes.curp    IS 'CURP del atleta (18 caracteres, identificador oficial)';
COMMENT ON COLUMN public.athletes.cp      IS 'Código Postal del domicilio del atleta';
COMMENT ON COLUMN public.athletes.colonia IS 'Colonia del domicilio del atleta';
COMMENT ON COLUMN public.athletes.phone   IS 'Teléfono directo del atleta (incluye lada)';
