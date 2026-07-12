/**
 * DiagnosticSectionDetail
 *
 * Renders the full evaluation data for one diagnostic section
 * (médico, nutrición, psicología, entrenador, fisioterapia).
 *
 * ACCESO: solo roles de staff — nunca visible al atleta.
 * El guard debe hacerse en el componente padre antes de renderizar éste.
 */

import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator, useColorScheme,
} from 'react-native';
import {
  getMedicalEvaluation,
  getNutritionEvaluation,
  getPsychologyEvaluation,
  getCoachEvaluation,
  getPhysioEvaluation,
} from '@/services/diagnostic';
import { Colors } from '@/constants/theme';
import type { DiagnosticSectionKey } from '@/types';

// ---------------------------------------------------------------------------
// Field group definitions (maps SQL comment groups → human labels)
// ---------------------------------------------------------------------------

type FieldGroup = {
  title:  string;
  fields: { key: string; label: string }[];
};

const MEDICAL_GROUPS: FieldGroup[] = [
  {
    title: 'Historia Médica',
    fields: [
      { key: 'consultation_reason',         label: 'Motivo de consulta' },
      { key: 'sport_medical_history',       label: 'Historia médica deportiva' },
      { key: 'injury_history',              label: 'Antecedentes de lesiones' },
      { key: 'medical_conditions',          label: 'Condiciones médicas' },
    ],
  },
  {
    title: 'Evaluación Antropométrica',
    fields: [
      { key: 'weight_kg',       label: 'Peso (kg)' },
      { key: 'height_cm',       label: 'Talla (cm)' },
      { key: 'bmi',             label: 'IMC' },
      { key: 'body_fat_pct',    label: '% Grasa corporal' },
    ],
  },
  {
    title: 'Signos Vitales',
    fields: [
      { key: 'heart_rate_rest',  label: 'FC en reposo' },
      { key: 'blood_pressure',   label: 'Tensión arterial' },
    ],
  },
  {
    title: 'Evaluación Cardiovascular',
    fields: [
      { key: 'ecg_rest',    label: 'ECG en reposo' },
      { key: 'ecg_effort',  label: 'ECG en esfuerzo' },
    ],
  },
  {
    title: 'Evaluación Musculoesquelética',
    fields: [
      { key: 'muscle_strength',  label: 'Fuerza muscular' },
      { key: 'flexibility',      label: 'Flexibilidad' },
      { key: 'posture',          label: 'Postura' },
      { key: 'joint_integrity',  label: 'Integridad articular' },
    ],
  },
  {
    title: 'Evaluación Funcional',
    fields: [
      { key: 'strength_tests',      label: 'Pruebas de fuerza' },
      { key: 'resistance_tests',    label: 'Pruebas de resistencia' },
      { key: 'flexibility_tests',   label: 'Pruebas de flexibilidad' },
      { key: 'balance_coordination',label: 'Equilibrio y coordinación' },
    ],
  },
  {
    title: 'Estudios de Laboratorio',
    fields: [
      { key: 'lab_biometria_hematica',   label: 'Biometría hemática' },
      { key: 'lab_quimica_sanguinea',    label: 'Química sanguínea' },
      { key: 'lab_electrocardiograma',   label: 'ECG (laboratorio)' },
      { key: 'lab_examen_orina',         label: 'Examen general de orina' },
      { key: 'lab_densitometria_osea',   label: 'Densitometría ósea' },
    ],
  },
  {
    title: 'Diagnóstico e Integración',
    fields: [
      { key: 'clinical_result',          label: 'Resultado clínico' },
      { key: 'diagnosis',                label: 'Diagnóstico' },
      { key: 'risk_level',               label: 'Nivel de riesgo' },
      { key: 'injury_risk_factors',      label: 'Factores de riesgo' },
      { key: 'diagnostic_integration',   label: 'Integración diagnóstica' },
      { key: 'care_priorities',          label: 'Prioridades de atención' },
    ],
  },
  {
    title: 'Plan Médico',
    fields: [
      { key: 'injury_prevention_plan',   label: 'Prevención de lesiones' },
      { key: 'medical_recommendations',  label: 'Recomendaciones médicas' },
      { key: 'recovery_strategies',      label: 'Estrategias de recuperación' },
      { key: 'training_load_control',    label: 'Control de carga' },
      { key: 'follow_up_schedule',       label: 'Programa de seguimiento' },
    ],
  },
  {
    title: 'Monitoreo y Observaciones',
    fields: [
      { key: 'monitoring_notes', label: 'Notas de monitoreo' },
      { key: 'observations',     label: 'Observaciones' },
    ],
  },
];

const NUTRITION_GROUPS: FieldGroup[] = [
  {
    title: 'Historia Clínica',
    fields: [
      { key: 'medical_antecedents',          label: 'Antecedentes médicos' },
      { key: 'heredofamilial_antecedents',   label: 'Antecedentes hereditarios' },
    ],
  },
  {
    title: 'Evaluación Antropométrica',
    fields: [
      { key: 'height_cm',         label: 'Talla (cm)' },
      { key: 'skinfolds',         label: 'Pliegues cutáneos' },
      { key: 'body_composition',  label: 'Composición corporal' },
    ],
  },
  {
    title: 'Evaluación Dietética',
    fields: [
      { key: 'food_intake',          label: 'Ingesta alimentaria' },
      { key: 'quantitative_data',    label: 'Datos cuantitativos' },
      { key: 'qualitative_data',     label: 'Datos cualitativos' },
      { key: 'energy_expenditure',   label: 'Gasto energético' },
      { key: 'calorie_percentages',  label: 'Distribución calórica' },
    ],
  },
  {
    title: 'Diagnóstico Nutricional',
    fields: [
      { key: 'clinical_metabolic_integration', label: 'Integración clínico-metabólica' },
      { key: 'nutritional_diagnosis',          label: 'Diagnóstico nutricional' },
      { key: 'qualitative_results',            label: 'Resultados cualitativos' },
      { key: 'quantitative_results',           label: 'Resultados cuantitativos' },
    ],
  },
  {
    title: 'Plan Alimentario',
    fields: [
      { key: 'food_plan',                  label: 'Plan alimentario' },
      { key: 'energy_requirements',        label: 'Requerimientos energéticos' },
      { key: 'sport_objectives',           label: 'Objetivos deportivos' },
      { key: 'individual_characteristics', label: 'Características individuales' },
      { key: 'observations',               label: 'Observaciones' },
    ],
  },
];

const PSYCHOLOGY_GROUPS: FieldGroup[] = [
  {
    title: 'Instrumentos de Evaluación',
    fields: [
      { key: 'sport_psychological_interview',  label: 'Entrevista psicológica deportiva' },
      { key: 'competitive_anxiety_inventory',  label: 'Inventario de ansiedad competitiva' },
      { key: 'sport_motivation_scale',         label: 'Escala de motivación deportiva' },
      { key: 'resilience_scale',               label: 'Escala de resiliencia' },
    ],
  },
  {
    title: 'Diagnóstico Psicológico',
    fields: [
      { key: 'emotional_regulation',   label: 'Regulación emocional' },
      { key: 'internal_motivation',    label: 'Motivación interna' },
      { key: 'external_motivation',    label: 'Motivación externa' },
      { key: 'pressure_tolerance',     label: 'Tolerancia a la presión' },
      { key: 'concentration',          label: 'Concentración' },
      { key: 'diagnostic_integration', label: 'Integración diagnóstica' },
    ],
  },
  {
    title: 'Plan de Intervención',
    fields: [
      { key: 'visualization',       label: 'Visualización' },
      { key: 'self_dialogue',       label: 'Diálogo interno' },
      { key: 'breathing_control',   label: 'Control de la respiración' },
      { key: 'goal_setting',        label: 'Establecimiento de metas' },
    ],
  },
  {
    title: 'Entrenamiento Psicológico',
    fields: [
      { key: 'concentration_training',    label: 'Entrenamiento de concentración' },
      { key: 'goal_follow_up',            label: 'Seguimiento de metas' },
      { key: 'practical_exercises',       label: 'Ejercicios prácticos' },
      { key: 'psychological_feedback',    label: 'Retroalimentación psicológica' },
    ],
  },
  {
    title: 'Seguimiento y Evaluación',
    fields: [
      { key: 'quantitative_psychological_state', label: 'Estado psicológico (cuantitativo)' },
      { key: 'quantitative_performance',         label: 'Rendimiento (cuantitativo)' },
      { key: 'sport_performance_impact',         label: 'Impacto en rendimiento deportivo' },
      { key: 'observations',                     label: 'Observaciones' },
    ],
  },
];

const COACH_GROUPS: FieldGroup[] = [
  {
    title: 'Pruebas Físicas',
    fields: [
      { key: 'strength_test',    label: 'Fuerza' },
      { key: 'power_test',       label: 'Potencia' },
      { key: 'speed_test',       label: 'Velocidad' },
      { key: 'endurance_test',   label: 'Resistencia' },
      { key: 'flexibility_test', label: 'Flexibilidad' },
    ],
  },
  {
    title: 'Análisis Técnico',
    fields: [
      { key: 'technical_weaknesses',     label: 'Áreas de mejora técnica' },
      { key: 'competitive_capabilities', label: 'Capacidades competitivas' },
    ],
  },
  {
    title: 'Evaluación Biomecánica',
    fields: [
      { key: 'movement_efficiency', label: 'Eficiencia de movimiento' },
      { key: 'body_mechanics',      label: 'Mecánica corporal' },
      { key: 'segment_alignment',   label: 'Alineación de segmentos' },
    ],
  },
  {
    title: 'Perfil e Intervención',
    fields: [
      { key: 'athlete_sport_profile',     label: 'Perfil deportivo del atleta' },
      { key: 'discipline_intervention',   label: 'Intervención por disciplina' },
    ],
  },
  {
    title: 'Plan de Entrenamiento',
    fields: [
      { key: 'season_structure',         label: 'Estructura de la temporada' },
      { key: 'competitive_calendar',     label: 'Calendario competitivo' },
      { key: 'performance_objectives',   label: 'Objetivos de rendimiento' },
      { key: 'preparation_stages',       label: 'Etapas de preparación' },
    ],
  },
  {
    title: 'Supervisión y Seguimiento',
    fields: [
      { key: 'technical_correction',   label: 'Corrección técnica' },
      { key: 'load_supervision',       label: 'Supervisión de cargas' },
      { key: 'competition_preparation',label: 'Preparación competitiva' },
      { key: 'performance_analysis',   label: 'Análisis de rendimiento' },
      { key: 'continuous_feedback',    label: 'Retroalimentación continua' },
      { key: 'mark_monitoring',        label: 'Seguimiento de marcas' },
      { key: 'plan_adjustments',       label: 'Ajustes del plan' },
      { key: 'observations',           label: 'Observaciones' },
    ],
  },
];

const PHYSIO_GROUPS: FieldGroup[] = [
  {
    title: 'Historia Clínica Fisioterapéutica',
    fields: [
      { key: 'sport_antecedents',        label: 'Antecedentes deportivos' },
      { key: 'previous_injuries',        label: 'Lesiones previas' },
      { key: 'current_symptoms',         label: 'Síntomas actuales' },
      { key: 'training_loads',           label: 'Cargas de entrenamiento' },
      { key: 'relevant_medical_factors', label: 'Factores médicos relevantes' },
    ],
  },
  {
    title: 'Evaluación Postural',
    fields: [
      { key: 'postural_anterior',  label: 'Vista anterior' },
      { key: 'postural_lateral',   label: 'Vista lateral' },
      { key: 'postural_posterior', label: 'Vista posterior' },
    ],
  },
  {
    title: 'Análisis de Movilidad',
    fields: [
      { key: 'joint_range_of_motion',   label: 'Rango de movimiento articular' },
      { key: 'strength_tests',          label: 'Pruebas de fuerza' },
      { key: 'contractile_capacity',    label: 'Capacidad contráctil' },
      { key: 'muscle_group_performance',label: 'Rendimiento de grupos musculares' },
    ],
  },
  {
    title: 'Diagnóstico Funcional',
    fields: [
      { key: 'muscle_imbalances',         label: 'Desequilibrios musculares' },
      { key: 'joint_limitations',         label: 'Limitaciones articulares' },
      { key: 'biomechanical_alterations', label: 'Alteraciones biomecánicas' },
      { key: 'injury_risk',               label: 'Riesgo de lesión' },
      { key: 'functional_diagnosis',      label: 'Diagnóstico funcional' },
      { key: 'discipline_intervention',   label: 'Intervención por disciplina' },
    ],
  },
  {
    title: 'Plan de Rehabilitación',
    fields: [
      { key: 'manual_therapy',            label: 'Terapia manual' },
      { key: 'specific_strengthening',    label: 'Fortalecimiento específico' },
      { key: 'neuromuscular_reeducation', label: 'Reeducación neuromuscular' },
      { key: 'mobility_exercises',        label: 'Ejercicios de movilidad' },
      { key: 'relapse_prevention',        label: 'Prevención de recaídas' },
    ],
  },
  {
    title: 'Métodos de Rehabilitación',
    fields: [
      { key: 'myofascial_release',           label: 'Liberación miofascial' },
      { key: 'joint_mobilization',           label: 'Movilización articular' },
      { key: 'sports_massage',               label: 'Masaje deportivo' },
      { key: 'tens_electrotherapy',          label: 'TENS / Electroterapia' },
      { key: 'therapeutic_ultrasound',       label: 'Ultrasonido terapéutico' },
      { key: 'muscle_electrostimulation',    label: 'Electroestimulación muscular' },
      { key: 'therapeutic_exercise',         label: 'Ejercicio terapéutico' },
      { key: 'observations',                 label: 'Observaciones' },
    ],
  },
];

const SECTION_GROUPS: Record<DiagnosticSectionKey, FieldGroup[]> = {
  medico:       MEDICAL_GROUPS,
  nutricion:    NUTRITION_GROUPS,
  psicologia:   PSYCHOLOGY_GROUPS,
  entrenador:   COACH_GROUPS,
  fisioterapia: PHYSIO_GROUPS,
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type EvalData = Record<string, unknown>;

async function fetchEvaluation(
  section: DiagnosticSectionKey,
  sectionId: string
): Promise<EvalData | null> {
  try {
    switch (section) {
      case 'medico':       return (await getMedicalEvaluation(sectionId))    as EvalData;
      case 'nutricion':    return (await getNutritionEvaluation(sectionId))  as EvalData;
      case 'psicologia':   return (await getPsychologyEvaluation(sectionId)) as EvalData;
      case 'entrenador':   return (await getCoachEvaluation(sectionId))      as EvalData;
      case 'fisioterapia': return (await getPhysioEvaluation(sectionId))     as EvalData;
    }
  } catch {
    return null;
  }
}

export function DiagnosticSectionDetail({
  section,
  sectionId,
}: {
  section:   DiagnosticSectionKey;
  sectionId: string;
}) {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];

  const [data, setData]       = useState<EvalData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchEvaluation(section, sectionId)
      .then(setData)
      .finally(() => setLoading(false));
  }, [section, sectionId]);

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="small" color={colors.icon} />
        <Text style={[styles.loadingText, { color: colors.icon }]}>
          Cargando evaluación…
        </Text>
      </View>
    );
  }

  if (!data) {
    return (
      <View style={styles.empty}>
        <Text style={[styles.emptyText, { color: colors.icon }]}>
          Aún no hay datos registrados para esta área.
        </Text>
      </View>
    );
  }

  const groups = SECTION_GROUPS[section] ?? [];

  // Only render groups that have at least one non-empty value
  const activeGroups = groups.filter((g) =>
    g.fields.some((f) => {
      const v = data[f.key];
      return v != null && v !== '';
    })
  );

  if (activeGroups.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={[styles.emptyText, { color: colors.icon }]}>
          El registro existe pero no contiene datos aún.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {activeGroups.map((group) => (
        <View key={group.title} style={[styles.group, { borderColor: scheme === 'dark' ? '#374151' : '#e2e8f0' }]}>
          <Text style={[styles.groupTitle, { color: colors.icon }]}>
            {group.title}
          </Text>
          {group.fields.map((f) => {
            const value = data[f.key];
            if (value == null || value === '') return null;
            return (
              <View key={f.key} style={[styles.row, { borderBottomColor: scheme === 'dark' ? '#374151' : '#f1f5f9' }]}>
                <Text style={[styles.label, { color: colors.icon }]}>{f.label}</Text>
                <Text style={[styles.value, { color: colors.text }]}>
                  {String(value)}
                </Text>
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container:   { marginTop: 12 },

  loader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  loadingText: { fontSize: 13 },

  empty: {
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  emptyText: { fontSize: 13, fontStyle: 'italic' },

  group: {
    borderWidth: 1,
    borderRadius: 10,
    marginBottom: 10,
    overflow: 'hidden',
  },
  groupTitle: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 6,
  },

  row: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  label: { fontSize: 11, marginBottom: 2 },
  value: { fontSize: 13, lineHeight: 18 },
});
