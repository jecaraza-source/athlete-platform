// =============================================================================
// lib/types/diagnostic.ts
// Tipos compartidos para el módulo de Diagnóstico Inicial Integral del Atleta
// =============================================================================

export type DiagnosticStatus =
  | 'pendiente'
  | 'en_proceso'
  | 'completo'
  | 'requiere_atencion';

export type DiagnosticSectionKey =
  | 'medico'
  | 'nutricion'
  | 'psicologia'
  | 'entrenador'
  | 'fisioterapia';

export type DisabilityStatus =
  | 'con_discapacidad'
  | 'sin_discapacidad';

export type PlanType =
  | 'medico'
  | 'alimentario'
  | 'psicologico'
  | 'entrenamiento'
  | 'rehabilitacion';

// -----------------------------------------------------------------------------
// Registros de base de datos
// -----------------------------------------------------------------------------

export type AthleteInitialDiagnostic = {
  id: string;
  athlete_id: string;
  overall_status: DiagnosticStatus;
  completion_pct: number;
  is_baseline: boolean;
  version: number;
  integrated_result: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AthleteSection = {
  id: string;
  diagnostic_id: string;
  athlete_id: string;
  section: DiagnosticSectionKey;
  status: DiagnosticStatus;
  completion_pct: number;
  completed_at: string | null;
  captured_at: string | null;
  updated_at: string | null;
};

export type MedicalEvaluation = {
  id: string;
  diagnostic_section_id: string;
  athlete_id: string;
  weight_kg: number | null;
  height_cm: number | null;
  bmi: number | null;
  body_fat_pct: number | null;
  heart_rate_rest: number | null;
  blood_pressure: string | null;
  ecg_rest: string | null;
  ecg_effort: string | null;
  muscle_strength: string | null;
  flexibility: string | null;
  posture: string | null;
  joint_integrity: string | null;
  strength_tests: string | null;
  resistance_tests: string | null;
  flexibility_tests: string | null;
  balance_coordination: string | null;
  injury_history: string | null;
  clinical_result: string | null;
  diagnosis: string | null;
  injury_risk_factors: string | null;
  medical_conditions: string | null;
  diagnostic_integration: string | null;
  risk_level: string | null;
  care_priorities: string | null;
  injury_prevention_plan: string | null;
  medical_recommendations: string | null;
  nutritional_coordination: string | null;
  recovery_strategies: string | null;
  training_load_control: string | null;
  follow_up_schedule: string | null;
  monitoring_notes: string | null;
  observations: string | null;
};

export type NutritionEvaluation = {
  id: string;
  diagnostic_section_id: string;
  athlete_id: string;
  medical_antecedents: string | null;
  heredofamilial_antecedents: string | null;
  height_cm: number | null;
  skinfolds: string | null;
  body_composition: string | null;
  food_intake: string | null;
  quantitative_data: string | null;
  qualitative_data: string | null;
  energy_expenditure: string | null;
  calorie_percentages: string | null;
  clinical_metabolic_integration: string | null;
  nutritional_diagnosis: string | null;
  qualitative_results: string | null;
  quantitative_results: string | null;
  food_plan: string | null;
  energy_requirements: string | null;
  sport_objectives: string | null;
  individual_characteristics: string | null;
  observations: string | null;
};

export type PsychologyEvaluation = {
  id: string;
  diagnostic_section_id: string;
  athlete_id: string;
  sport_psychological_interview: string | null;
  competitive_anxiety_inventory: string | null;
  sport_motivation_scale: string | null;
  resilience_scale: string | null;
  emotional_regulation: string | null;
  internal_motivation: string | null;
  external_motivation: string | null;
  pressure_tolerance: string | null;
  concentration: string | null;
  diagnostic_integration: string | null;
  visualization: string | null;
  self_dialogue: string | null;
  breathing_control: string | null;
  goal_setting: string | null;
  concentration_training: string | null;
  goal_follow_up: string | null;
  practical_exercises: string | null;
  psychological_feedback: string | null;
  quantitative_psychological_state: string | null;
  quantitative_performance: string | null;
  sport_performance_impact: string | null;
  observations: string | null;
};

export type CoachEvaluation = {
  id: string;
  diagnostic_section_id: string;
  athlete_id: string;
  strength_test: string | null;
  power_test: string | null;
  speed_test: string | null;
  endurance_test: string | null;
  flexibility_test: string | null;
  technical_weaknesses: string | null;
  competitive_capabilities: string | null;
  movement_efficiency: string | null;
  body_mechanics: string | null;
  segment_alignment: string | null;
  athlete_sport_profile: string | null;
  discipline_intervention: string | null;
  season_structure: string | null;
  competitive_calendar: string | null;
  performance_objectives: string | null;
  preparation_stages: string | null;
  technical_correction: string | null;
  load_supervision: string | null;
  competition_preparation: string | null;
  performance_analysis: string | null;
  continuous_feedback: string | null;
  mark_monitoring: string | null;
  plan_adjustments: string | null;
  observations: string | null;
};

export type PhysioEvaluation = {
  id: string;
  diagnostic_section_id: string;
  athlete_id: string;
  sport_antecedents: string | null;
  previous_injuries: string | null;
  current_symptoms: string | null;
  training_loads: string | null;
  relevant_medical_factors: string | null;
  postural_anterior: string | null;
  postural_lateral: string | null;
  postural_posterior: string | null;
  joint_range_of_motion: string | null;
  strength_tests: string | null;
  contractile_capacity: string | null;
  muscle_group_performance: string | null;
  muscle_imbalances: string | null;
  joint_limitations: string | null;
  biomechanical_alterations: string | null;
  injury_risk: string | null;
  functional_diagnosis: string | null;
  discipline_intervention: string | null;
  manual_therapy: string | null;
  specific_strengthening: string | null;
  neuromuscular_reeducation: string | null;
  mobility_exercises: string | null;
  relapse_prevention: string | null;
  myofascial_release: string | null;
  joint_mobilization: string | null;
  sports_massage: string | null;
  tens_electrotherapy: string | null;
  therapeutic_ultrasound: string | null;
  muscle_electrostimulation: string | null;
  therapeutic_exercise: string | null;
  observations: string | null;
};

export type IntegratedResults = {
  id: string;
  diagnostic_id: string;
  athlete_id: string;
  overall_summary: string | null;
  medical_summary: string | null;
  nutritional_summary: string | null;
  psychological_summary: string | null;
  sport_profile: string | null;
  physiotherapy_summary: string | null;
  interdisciplinary_result: string | null;
  generated_at: string;
};

// -----------------------------------------------------------------------------
// Constantes de UI
// -----------------------------------------------------------------------------

export const SECTION_KEYS: DiagnosticSectionKey[] = [
  'medico',
  'nutricion',
  'psicologia',
  'entrenador',
  'fisioterapia',
];

export const SECTION_LABELS: Record<DiagnosticSectionKey, string> = {
  medico:       'Médico',
  nutricion:    'Nutrición',
  psicologia:   'Psicología',
  entrenador:   'Entrenador',
  fisioterapia: 'Fisioterapia',
};

export const STATUS_LABELS: Record<DiagnosticStatus, string> = {
  pendiente:         'Pendiente',
  en_proceso:        'En proceso',
  completo:          'Completo',
  requiere_atencion: 'Requiere atención',
};

export const STATUS_COLORS: Record<DiagnosticStatus, string> = {
  pendiente:         'bg-gray-100 text-gray-600 border-gray-200',
  en_proceso:        'bg-yellow-100 text-yellow-700 border-yellow-200',
  completo:          'bg-green-100 text-green-700 border-green-200',
  requiere_atencion: 'bg-red-100 text-red-700 border-red-200',
};

export const STATUS_DOT: Record<DiagnosticStatus, string> = {
  pendiente:         'bg-gray-400',
  en_proceso:        'bg-yellow-500',
  completo:          'bg-green-500',
  requiere_atencion: 'bg-red-500',
};

export const DISCIPLINES = [
  { value: 'judo',               label: 'Judo',                         block: 'Combate' },
  { value: 'karate',             label: 'Karate',                       block: 'Combate' },
  { value: 'taekwondo',          label: 'Tae Kwon Do',                  block: 'Combate' },
  { value: 'atletismo',          label: 'Atletismo',                    block: 'Resistencia' },
  { value: 'natacion',           label: 'Natación',                     block: 'Resistencia' },
  { value: 'canotaje',           label: 'Canotaje',                     block: 'Resistencia' },
  { value: 'parabadminton',      label: 'Parabadminton',                block: 'Resistencia' },
  { value: 'tiro_arco',          label: 'Tiro con Arco',                block: 'Precisión' },
  { value: 'tiro_deportivo',     label: 'Tiro Deportivo',               block: 'Precisión' },
  { value: 'gimnasia_artistica', label: 'Gimnasia Artística Femenil',   block: 'Acrobático' },
  { value: 'breaking',           label: 'Breaking',                     block: 'Acrobático' },
] as const;

export type DisciplineValue = typeof DISCIPLINES[number]['value'];

export function getDisciplineLabel(value: string | null | undefined): string {
  if (!value) return '—';
  return DISCIPLINES.find(d => d.value === value)?.label ?? value;
}

export function getDisabilityLabel(value: string | null | undefined): string {
  if (value === 'con_discapacidad')  return 'Con discapacidad';
  if (value === 'sin_discapacidad')  return 'Sin discapacidad';
  return '—';
}
