-- =============================================================================
-- 031_medical_new_fields.sql
-- Adds new clinical fields to athlete_medical_evaluation:
--   · Historia Médica Deportiva
--   · Motivo de Consulta
--   · Antecedentes Heredofamiliares (Patológicos, No Patológicos,
--     Andrológicos, Gineco-Obstétricos)
--   · Estudios de Laboratorio y Gabinete (Biometría Hemática,
--     Química Sanguínea, Electrocardiograma, Examen General de Orina,
--     Densitometría Ósea)
-- =============================================================================

ALTER TABLE public.athlete_medical_evaluation
  -- Historia Médica Deportiva
  ADD COLUMN IF NOT EXISTS sport_medical_history           TEXT,
  -- Motivo de Consulta
  ADD COLUMN IF NOT EXISTS consultation_reason             TEXT,
  -- Antecedentes Heredofamiliares
  ADD COLUMN IF NOT EXISTS heredofamilial_pathological     TEXT,
  ADD COLUMN IF NOT EXISTS heredofamilial_non_pathological TEXT,
  ADD COLUMN IF NOT EXISTS heredofamilial_andrological     TEXT,
  ADD COLUMN IF NOT EXISTS heredofamilial_gyneco_obstetric TEXT,
  -- Estudios de Laboratorio y Gabinete (notas por estudio)
  ADD COLUMN IF NOT EXISTS lab_biometria_hematica          TEXT,
  ADD COLUMN IF NOT EXISTS lab_quimica_sanguinea           TEXT,
  ADD COLUMN IF NOT EXISTS lab_electrocardiograma          TEXT,
  ADD COLUMN IF NOT EXISTS lab_examen_orina                TEXT,
  ADD COLUMN IF NOT EXISTS lab_densitometria_osea          TEXT;
