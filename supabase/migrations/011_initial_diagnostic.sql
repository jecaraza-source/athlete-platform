-- =============================================================================
-- 011_initial_diagnostic.sql
-- Diagnóstico Inicial Integral del Atleta
-- Extiende athletes con discipline y disability_status.
-- Crea catálogos, estructura de diagnóstico por rubro y bitácora.
-- Seguro para ejecutar sobre datos existentes (IF NOT EXISTS / ADD COLUMN IF NOT EXISTS).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Extender tabla athletes
-- ---------------------------------------------------------------------------

ALTER TABLE public.athletes
  ADD COLUMN IF NOT EXISTS discipline        TEXT,
  ADD COLUMN IF NOT EXISTS disability_status TEXT
    CHECK (disability_status IN ('con_discapacidad', 'sin_discapacidad'));

-- ---------------------------------------------------------------------------
-- 2. Catálogo de disciplinas deportivas
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.cat_disciplines (
  id    SERIAL PRIMARY KEY,
  code  TEXT UNIQUE NOT NULL,
  name  TEXT NOT NULL,
  block TEXT NOT NULL  -- combate | resistencia | precision | acrobatico
);

ALTER TABLE public.cat_disciplines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read cat_disciplines"
  ON public.cat_disciplines FOR SELECT TO authenticated USING (true);

INSERT INTO public.cat_disciplines (code, name, block) VALUES
  ('judo',               'Judo',                       'combate'),
  ('karate',             'Karate',                     'combate'),
  ('taekwondo',          'Tae Kwon Do',                'combate'),
  ('atletismo',          'Atletismo',                  'resistencia'),
  ('natacion',           'Natación',                   'resistencia'),
  ('canotaje',           'Canotaje',                   'resistencia'),
  ('parabadminton',      'Parabadminton',              'resistencia'),
  ('tiro_arco',          'Tiro con Arco',              'precision'),
  ('tiro_deportivo',     'Tiro Deportivo',             'precision'),
  ('gimnasia_artistica', 'Gimnasia Artística Femenil', 'acrobatico'),
  ('breaking',           'Breaking',                   'acrobatico')
ON CONFLICT (code) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 3. Catálogo de niveles de riesgo
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.cat_risk_levels (
  id    SERIAL PRIMARY KEY,
  code  TEXT UNIQUE NOT NULL,
  name  TEXT NOT NULL,
  color TEXT
);

ALTER TABLE public.cat_risk_levels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read cat_risk_levels"
  ON public.cat_risk_levels FOR SELECT TO authenticated USING (true);

INSERT INTO public.cat_risk_levels (code, name, color) VALUES
  ('bajo',    'Bajo',     '#22c55e'),
  ('medio',   'Medio',    '#eab308'),
  ('alto',    'Alto',     '#f97316'),
  ('critico', 'Crítico',  '#ef4444')
ON CONFLICT (code) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 4. Registro principal del diagnóstico inicial (uno por atleta)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.athlete_initial_diagnostic (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id      UUID        NOT NULL REFERENCES public.athletes(id) ON DELETE CASCADE UNIQUE,
  overall_status  TEXT        NOT NULL DEFAULT 'pendiente'
    CHECK (overall_status IN ('pendiente', 'en_proceso', 'completo', 'requiere_atencion')),
  completion_pct  INTEGER     NOT NULL DEFAULT 0 CHECK (completion_pct BETWEEN 0 AND 100),
  is_baseline     BOOLEAN     NOT NULL DEFAULT true,
  version         INTEGER     NOT NULL DEFAULT 1,
  integrated_result TEXT,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_aid_athlete ON public.athlete_initial_diagnostic(athlete_id);

ALTER TABLE public.athlete_initial_diagnostic ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read athlete_initial_diagnostic"
  ON public.athlete_initial_diagnostic FOR SELECT TO authenticated USING (true);

-- ---------------------------------------------------------------------------
-- 5. Secciones del diagnóstico (una por rubro, por atleta)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.athlete_diagnostic_sections (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  diagnostic_id   UUID        NOT NULL REFERENCES public.athlete_initial_diagnostic(id) ON DELETE CASCADE,
  athlete_id      UUID        NOT NULL REFERENCES public.athletes(id) ON DELETE CASCADE,
  section         TEXT        NOT NULL
    CHECK (section IN ('medico', 'nutricion', 'psicologia', 'entrenador', 'fisioterapia')),
  status          TEXT        NOT NULL DEFAULT 'pendiente'
    CHECK (status IN ('pendiente', 'en_proceso', 'completo', 'requiere_atencion')),
  completion_pct  INTEGER     NOT NULL DEFAULT 0,
  completed_at    TIMESTAMPTZ,
  completed_by    UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  captured_by     UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  captured_at     TIMESTAMPTZ,
  updated_by      UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at      TIMESTAMPTZ,
  UNIQUE(diagnostic_id, section)
);

CREATE INDEX IF NOT EXISTS idx_ads_diagnostic ON public.athlete_diagnostic_sections(diagnostic_id);
CREATE INDEX IF NOT EXISTS idx_ads_athlete    ON public.athlete_diagnostic_sections(athlete_id);

ALTER TABLE public.athlete_diagnostic_sections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read athlete_diagnostic_sections"
  ON public.athlete_diagnostic_sections FOR SELECT TO authenticated USING (true);

-- ---------------------------------------------------------------------------
-- 6. Evaluación Médica
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.athlete_medical_evaluation (
  id                        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  diagnostic_section_id     UUID        NOT NULL REFERENCES public.athlete_diagnostic_sections(id) ON DELETE CASCADE UNIQUE,
  athlete_id                UUID        NOT NULL REFERENCES public.athletes(id) ON DELETE CASCADE,
  -- Evaluación Antropométrica
  weight_kg                 NUMERIC(5,2),
  height_cm                 NUMERIC(5,1),
  bmi                       NUMERIC(4,1),
  body_fat_pct              NUMERIC(4,1),
  -- Signos Vitales
  heart_rate_rest           INTEGER,
  blood_pressure            TEXT,
  -- Evaluación Cardiovascular
  ecg_rest                  TEXT,
  ecg_effort                TEXT,
  -- Evaluación Musculoesquelética y Postural
  muscle_strength           TEXT,
  flexibility               TEXT,
  posture                   TEXT,
  joint_integrity           TEXT,
  -- Evaluación Funcional
  strength_tests            TEXT,
  resistance_tests          TEXT,
  flexibility_tests         TEXT,
  balance_coordination      TEXT,
  -- Antecedentes de Lesiones
  injury_history            TEXT,
  -- Resultados
  clinical_result           TEXT,
  diagnosis                 TEXT,
  -- Factores de Riesgo
  injury_risk_factors       TEXT,
  medical_conditions        TEXT,
  -- Integración Diagnóstica
  diagnostic_integration    TEXT,
  risk_level                TEXT,
  care_priorities           TEXT,
  -- Plan Médico Individual
  injury_prevention_plan    TEXT,
  medical_recommendations   TEXT,
  nutritional_coordination  TEXT,
  recovery_strategies       TEXT,
  training_load_control     TEXT,
  follow_up_schedule        TEXT,
  -- Monitoreo
  monitoring_notes          TEXT,
  -- Observaciones
  observations              TEXT,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.athlete_medical_evaluation ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read athlete_medical_evaluation"
  ON public.athlete_medical_evaluation FOR SELECT TO authenticated USING (true);

-- ---------------------------------------------------------------------------
-- 7. Evaluación Nutricional
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.athlete_nutrition_evaluation (
  id                              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  diagnostic_section_id           UUID        NOT NULL REFERENCES public.athlete_diagnostic_sections(id) ON DELETE CASCADE UNIQUE,
  athlete_id                      UUID        NOT NULL REFERENCES public.athletes(id) ON DELETE CASCADE,
  -- Historia Clínica
  medical_antecedents             TEXT,
  heredofamilial_antecedents      TEXT,
  -- Evaluación Antropométrica
  height_cm                       NUMERIC(5,1),
  skinfolds                       TEXT,
  body_composition                TEXT,
  -- Evaluación Dietética
  food_intake                     TEXT,
  quantitative_data               TEXT,
  qualitative_data                TEXT,
  -- Gasto Energético
  energy_expenditure              TEXT,
  calorie_percentages             TEXT,
  -- Integración
  clinical_metabolic_integration  TEXT,
  -- Diagnóstico Integral
  nutritional_diagnosis           TEXT,
  qualitative_results             TEXT,
  quantitative_results            TEXT,
  -- Plan Alimentario Personalizado
  food_plan                       TEXT,
  energy_requirements             TEXT,
  sport_objectives                TEXT,
  individual_characteristics      TEXT,
  -- Observaciones
  observations                    TEXT,
  created_at                      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.athlete_nutrition_evaluation ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read athlete_nutrition_evaluation"
  ON public.athlete_nutrition_evaluation FOR SELECT TO authenticated USING (true);

-- ---------------------------------------------------------------------------
-- 8. Evaluación Psicológica
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.athlete_psychology_evaluation (
  id                                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  diagnostic_section_id             UUID        NOT NULL REFERENCES public.athlete_diagnostic_sections(id) ON DELETE CASCADE UNIQUE,
  athlete_id                        UUID        NOT NULL REFERENCES public.athletes(id) ON DELETE CASCADE,
  -- Historia Clínica
  sport_psychological_interview     TEXT,
  competitive_anxiety_inventory     TEXT,
  sport_motivation_scale            TEXT,
  resilience_scale                  TEXT,
  -- Diagnóstico Psicológico
  emotional_regulation              TEXT,
  internal_motivation               TEXT,
  external_motivation               TEXT,
  pressure_tolerance                TEXT,
  concentration                     TEXT,
  diagnostic_integration            TEXT,
  -- Plan de Intervención
  visualization                     TEXT,
  self_dialogue                     TEXT,
  breathing_control                 TEXT,
  goal_setting                      TEXT,
  -- Entrenamiento Psicológico
  concentration_training            TEXT,
  goal_follow_up                    TEXT,
  practical_exercises               TEXT,
  psychological_feedback            TEXT,
  -- Seguimiento y Evaluación
  quantitative_psychological_state  TEXT,
  quantitative_performance          TEXT,
  sport_performance_impact          TEXT,
  -- Observaciones
  observations                      TEXT,
  created_at                        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.athlete_psychology_evaluation ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read athlete_psychology_evaluation"
  ON public.athlete_psychology_evaluation FOR SELECT TO authenticated USING (true);

-- ---------------------------------------------------------------------------
-- 9. Evaluación del Entrenador
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.athlete_coach_evaluation (
  id                        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  diagnostic_section_id     UUID        NOT NULL REFERENCES public.athlete_diagnostic_sections(id) ON DELETE CASCADE UNIQUE,
  athlete_id                UUID        NOT NULL REFERENCES public.athletes(id) ON DELETE CASCADE,
  -- Pruebas Físicas
  strength_test             TEXT,
  power_test                TEXT,
  speed_test                TEXT,
  endurance_test            TEXT,
  flexibility_test          TEXT,
  -- Análisis Técnico
  technical_weaknesses      TEXT,
  competitive_capabilities  TEXT,
  -- Evaluación Biomecánica
  movement_efficiency       TEXT,
  body_mechanics            TEXT,
  segment_alignment         TEXT,
  -- Perfil Deportivo
  athlete_sport_profile     TEXT,
  -- Intervención por Disciplina
  discipline_intervention   TEXT,
  -- Plan de Entrenamiento Individualizado
  season_structure          TEXT,
  competitive_calendar      TEXT,
  performance_objectives    TEXT,
  preparation_stages        TEXT,
  -- Supervisión del Entrenador
  technical_correction      TEXT,
  load_supervision          TEXT,
  competition_preparation   TEXT,
  performance_analysis      TEXT,
  continuous_feedback       TEXT,
  mark_monitoring           TEXT,
  plan_adjustments          TEXT,
  -- Observaciones
  observations              TEXT,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.athlete_coach_evaluation ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read athlete_coach_evaluation"
  ON public.athlete_coach_evaluation FOR SELECT TO authenticated USING (true);

-- ---------------------------------------------------------------------------
-- 10. Evaluación de Fisioterapia
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.athlete_physiotherapy_evaluation (
  id                          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  diagnostic_section_id       UUID        NOT NULL REFERENCES public.athlete_diagnostic_sections(id) ON DELETE CASCADE UNIQUE,
  athlete_id                  UUID        NOT NULL REFERENCES public.athletes(id) ON DELETE CASCADE,
  -- Historia Clínica Fisioterapéutica
  sport_antecedents           TEXT,
  previous_injuries           TEXT,
  current_symptoms            TEXT,
  training_loads              TEXT,
  relevant_medical_factors    TEXT,
  -- Evaluación Postural
  postural_anterior           TEXT,
  postural_lateral            TEXT,
  postural_posterior          TEXT,
  -- Análisis de Movilidad Articular
  joint_range_of_motion       TEXT,
  strength_tests              TEXT,
  contractile_capacity        TEXT,
  muscle_group_performance    TEXT,
  -- Diagnóstico Funcional
  muscle_imbalances           TEXT,
  joint_limitations           TEXT,
  biomechanical_alterations   TEXT,
  injury_risk                 TEXT,
  functional_diagnosis        TEXT,
  -- Intervención por Disciplina
  discipline_intervention     TEXT,
  -- Plan de Rehabilitación
  manual_therapy              TEXT,
  specific_strengthening      TEXT,
  neuromuscular_reeducation   TEXT,
  mobility_exercises          TEXT,
  relapse_prevention          TEXT,
  -- Métodos de Rehabilitación
  myofascial_release          TEXT,
  joint_mobilization          TEXT,
  sports_massage              TEXT,
  tens_electrotherapy         TEXT,
  therapeutic_ultrasound      TEXT,
  muscle_electrostimulation   TEXT,
  therapeutic_exercise        TEXT,
  -- Observaciones
  observations                TEXT,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.athlete_physiotherapy_evaluation ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read athlete_physiotherapy_evaluation"
  ON public.athlete_physiotherapy_evaluation FOR SELECT TO authenticated USING (true);

-- ---------------------------------------------------------------------------
-- 11. Resultados Integrados Interdisciplinarios
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.athlete_integrated_results (
  id                        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  diagnostic_id             UUID        NOT NULL REFERENCES public.athlete_initial_diagnostic(id) ON DELETE CASCADE UNIQUE,
  athlete_id                UUID        NOT NULL REFERENCES public.athletes(id) ON DELETE CASCADE,
  overall_summary           TEXT,
  medical_summary           TEXT,
  nutritional_summary       TEXT,
  psychological_summary     TEXT,
  sport_profile             TEXT,
  physiotherapy_summary     TEXT,
  interdisciplinary_result  TEXT,
  generated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  generated_by              UUID        REFERENCES public.profiles(id) ON DELETE SET NULL
);

ALTER TABLE public.athlete_integrated_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read athlete_integrated_results"
  ON public.athlete_integrated_results FOR SELECT TO authenticated USING (true);

-- ---------------------------------------------------------------------------
-- 12. Planes Individuales (uno por tipo, por diagnóstico)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.athlete_individual_plans (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  diagnostic_id UUID        NOT NULL REFERENCES public.athlete_initial_diagnostic(id) ON DELETE CASCADE,
  athlete_id    UUID        NOT NULL REFERENCES public.athletes(id) ON DELETE CASCADE,
  plan_type     TEXT        NOT NULL
    CHECK (plan_type IN ('medico', 'alimentario', 'psicologico', 'entrenamiento', 'rehabilitacion')),
  content       TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by    UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  UNIQUE(diagnostic_id, plan_type)
);

ALTER TABLE public.athlete_individual_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read athlete_individual_plans"
  ON public.athlete_individual_plans FOR SELECT TO authenticated USING (true);

-- ---------------------------------------------------------------------------
-- 13. Bitácora / Historial de seguimiento
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.athlete_follow_up_log (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id    UUID        NOT NULL REFERENCES public.athletes(id) ON DELETE CASCADE,
  diagnostic_id UUID        REFERENCES public.athlete_initial_diagnostic(id) ON DELETE SET NULL,
  section       TEXT,
  action        TEXT        NOT NULL,
  notes         TEXT,
  logged_by     UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  logged_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_follow_up_log_athlete ON public.athlete_follow_up_log(athlete_id);
CREATE INDEX IF NOT EXISTS idx_follow_up_log_logged  ON public.athlete_follow_up_log(logged_at DESC);

ALTER TABLE public.athlete_follow_up_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read athlete_follow_up_log"
  ON public.athlete_follow_up_log FOR SELECT TO authenticated USING (true);
