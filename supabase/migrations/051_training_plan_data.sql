-- =============================================================================
-- 051_training_plan_data.sql
-- Adds a structured JSONB column to the plans table to hold the full
-- individualised training plan data imported from Excel (PE GAF, etc.).
--
-- Schema stored in training_plan_data:
-- {
--   "categoria":          "NIVEL 1",
--   "edad":               8,
--   "evaluacion_fisica":  { "fuerza": "...", "potencia": "...", "velocidad": "...",
--                           "resistencia": "...", "flexibilidad": "..." },
--   "analisis_tecnico":   { "debilidades": "...", "capacidades_competitivas": "..." },
--   "evaluacion_biomecanica": { "eficiencia": "...", "mecanica": "...", "alineacion": "..." },
--   "perfil_deportivo":   "...",
--   "intervencion":       { "bloques": "...", "plan_especifico": "..." },
--   "plan_individualizado": { "estructura_temporada": "...", "calendario_competitivo": "...",
--                             "objetivos_rendimiento": "...", "etapas_preparacion": "..." },
--   "supervision_entrenador": {
--     "correccion_tecnica": "...", "supervision_cargas": "...",
--     "preparacion_competencia": "...", "analisis_desempeno": "...",
--     "retroalimentacion": "...", "monitoreo_marcas": "...", "ajuste_plan": "..."
--   },
--   "observaciones_generales": "..."
-- }
-- =============================================================================

ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS training_plan_data jsonb;

COMMENT ON COLUMN public.plans.training_plan_data IS
  'Structured training plan data imported from the PE Excel files '
  '(evaluación física, análisis técnico, biomecánica, etc.).';
