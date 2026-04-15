'use server';

import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { assertPermission } from '@/lib/rbac/server';
import { SECTION_KEYS, type DiagnosticSectionKey } from '@/lib/types/diagnostic';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function str(formData: FormData, key: string): string | null {
  const v = (formData.get(key) as string)?.trim();
  return v || null;
}

function num(formData: FormData, key: string): number | null {
  const v = formData.get(key) as string;
  if (!v) return null;
  const n = parseFloat(v);
  return isNaN(n) ? null : n;
}

async function recalculateOverall(diagnosticId: string, athleteId: string): Promise<void> {
  const { data: sections } = await supabaseAdmin
    .from('athlete_diagnostic_sections')
    .select('status, completion_pct')
    .eq('diagnostic_id', diagnosticId);

  if (!sections) return;

  const total     = sections.length;
  const completed = sections.filter((s) => s.status === 'completo').length;
  const hasAttn   = sections.some((s) => s.status === 'requiere_atencion');
  const inProcess = sections.some((s) => s.status === 'en_proceso');
  const pct       = total > 0 ? Math.round((completed / total) * 100) : 0;

  let overallStatus: string;
  if (hasAttn)             overallStatus = 'requiere_atencion';
  else if (completed === total && total > 0) overallStatus = 'completo';
  else if (completed > 0 || inProcess) overallStatus = 'en_proceso';
  else                     overallStatus = 'pendiente';

  await supabaseAdmin
    .from('athlete_initial_diagnostic')
    .update({
      completion_pct: pct,
      overall_status: overallStatus,
      updated_at:     new Date().toISOString(),
      ...(overallStatus === 'completo' ? { completed_at: new Date().toISOString() } : {}),
    })
    .eq('id', diagnosticId);
}

async function logAction(
  athleteId: string,
  diagnosticId: string,
  section: string,
  action: string,
): Promise<void> {
  await supabaseAdmin.from('athlete_follow_up_log').insert({
    athlete_id:    athleteId,
    diagnostic_id: diagnosticId,
    section,
    action,
  });
}

async function ensureSectionRecord(
  athleteId: string,
  section: DiagnosticSectionKey,
): Promise<{ id: string; diagnostic_id: string } | null> {
  // 1. Ensure the diagnostic header exists (create with all 5 sections on first use)
  let { data: diag } = await supabaseAdmin
    .from('athlete_initial_diagnostic')
    .select('id')
    .eq('athlete_id', athleteId)
    .maybeSingle();

  if (!diag) {
    const { data: created, error } = await supabaseAdmin
      .from('athlete_initial_diagnostic')
      .insert({ athlete_id: athleteId })
      .select('id')
      .single();
    if (error || !created) return null;
    diag = created;

    // Seed all 5 section rows so the progress calculation is accurate from the start
    await supabaseAdmin.from('athlete_diagnostic_sections').insert(
      SECTION_KEYS.map((s) => ({
        diagnostic_id: created.id,
        athlete_id:    athleteId,
        section:       s,
      }))
    );
  }

  // 2. Fetch the specific section row (handles older diagnostics missing sections)
  const { data: sec } = await supabaseAdmin
    .from('athlete_diagnostic_sections')
    .select('id, diagnostic_id')
    .eq('athlete_id', athleteId)
    .eq('section', section)
    .maybeSingle();

  if (sec) return sec;

  // 3. Section missing on an older diagnostic — create it individually
  const { data: newSec, error: secErr } = await supabaseAdmin
    .from('athlete_diagnostic_sections')
    .insert({ diagnostic_id: diag.id, athlete_id: athleteId, section })
    .select('id, diagnostic_id')
    .single();

  return secErr ? null : newSec;
}

async function updateSectionStatus(
  sectionId: string,
  diagnosticId: string,
  athleteId: string,
  complete: boolean,
): Promise<void> {
  const now = new Date().toISOString();
  await supabaseAdmin
    .from('athlete_diagnostic_sections')
    .update({
      status:         complete ? 'completo' : 'en_proceso',
      completion_pct: complete ? 100 : 50,
      updated_at:     now,
      captured_at:    now,
      ...(complete ? { completed_at: now } : {}),
    })
    .eq('id', sectionId);

  await recalculateOverall(diagnosticId, athleteId);
}

// ---------------------------------------------------------------------------
// Rubro Médico
// ---------------------------------------------------------------------------

function extractMedicalPayload(formData: FormData) {
  return {
    weight_kg:                num(formData, 'weight_kg'),
    height_cm:                num(formData, 'height_cm'),
    bmi:                      num(formData, 'bmi'),
    body_fat_pct:             num(formData, 'body_fat_pct'),
    heart_rate_rest:          num(formData, 'heart_rate_rest'),
    blood_pressure:           str(formData, 'blood_pressure'),
    ecg_rest:                 str(formData, 'ecg_rest'),
    ecg_effort:               str(formData, 'ecg_effort'),
    muscle_strength:          str(formData, 'muscle_strength'),
    flexibility:              str(formData, 'flexibility'),
    posture:                  str(formData, 'posture'),
    joint_integrity:          str(formData, 'joint_integrity'),
    strength_tests:           str(formData, 'strength_tests'),
    resistance_tests:         str(formData, 'resistance_tests'),
    flexibility_tests:        str(formData, 'flexibility_tests'),
    balance_coordination:     str(formData, 'balance_coordination'),
    injury_history:           str(formData, 'injury_history'),
    clinical_result:          str(formData, 'clinical_result'),
    diagnosis:                str(formData, 'diagnosis'),
    injury_risk_factors:      str(formData, 'injury_risk_factors'),
    medical_conditions:       str(formData, 'medical_conditions'),
    diagnostic_integration:   str(formData, 'diagnostic_integration'),
    risk_level:               str(formData, 'risk_level'),
    care_priorities:          str(formData, 'care_priorities'),
    injury_prevention_plan:   str(formData, 'injury_prevention_plan'),
    medical_recommendations:  str(formData, 'medical_recommendations'),
    nutritional_coordination: str(formData, 'nutritional_coordination'),
    recovery_strategies:      str(formData, 'recovery_strategies'),
    training_load_control:    str(formData, 'training_load_control'),
    follow_up_schedule:       str(formData, 'follow_up_schedule'),
    monitoring_notes:         str(formData, 'monitoring_notes'),
    observations:             str(formData, 'observations'),
    updated_at:               new Date().toISOString(),
  };
}

export async function saveMedicalSection(
  athleteId: string,
  complete: boolean,
  formData: FormData,
): Promise<{ error: string | null }> {
  const denied = await assertPermission('edit_athletes');
  if (denied) return denied;

  const section = await ensureSectionRecord(athleteId, 'medico');
  if (!section) return { error: 'No se pudo inicializar la sección médica.' };

  const payload = extractMedicalPayload(formData);

  const { error } = await supabaseAdmin
    .from('athlete_medical_evaluation')
    .upsert(
      { diagnostic_section_id: section.id, athlete_id: athleteId, ...payload },
      { onConflict: 'diagnostic_section_id' },
    );

  if (error) return { error: error.message };

  await updateSectionStatus(section.id, section.diagnostic_id, athleteId, complete);
  await logAction(athleteId, section.diagnostic_id, 'medico', complete ? 'rubro_completado' : 'borrador_guardado');

  revalidatePath(`/athletes/${athleteId}/diagnostic`);
  revalidatePath(`/athletes/${athleteId}`);
  return { error: null };
}

// ---------------------------------------------------------------------------
// Rubro Nutrición
// ---------------------------------------------------------------------------

function extractNutritionPayload(formData: FormData) {
  return {
    medical_antecedents:            str(formData, 'medical_antecedents'),
    heredofamilial_antecedents:     str(formData, 'heredofamilial_antecedents'),
    height_cm:                      num(formData, 'height_cm'),
    skinfolds:                      str(formData, 'skinfolds'),
    body_composition:               str(formData, 'body_composition'),
    food_intake:                    str(formData, 'food_intake'),
    quantitative_data:              str(formData, 'quantitative_data'),
    qualitative_data:               str(formData, 'qualitative_data'),
    energy_expenditure:             str(formData, 'energy_expenditure'),
    calorie_percentages:            str(formData, 'calorie_percentages'),
    clinical_metabolic_integration: str(formData, 'clinical_metabolic_integration'),
    nutritional_diagnosis:          str(formData, 'nutritional_diagnosis'),
    qualitative_results:            str(formData, 'qualitative_results'),
    quantitative_results:           str(formData, 'quantitative_results'),
    food_plan:                      str(formData, 'food_plan'),
    energy_requirements:            str(formData, 'energy_requirements'),
    sport_objectives:               str(formData, 'sport_objectives'),
    individual_characteristics:     str(formData, 'individual_characteristics'),
    observations:                   str(formData, 'observations'),
    updated_at:                     new Date().toISOString(),
  };
}

export async function saveNutritionSection(
  athleteId: string,
  complete: boolean,
  formData: FormData,
): Promise<{ error: string | null }> {
  const denied = await assertPermission('edit_athletes');
  if (denied) return denied;

  const section = await ensureSectionRecord(athleteId, 'nutricion');
  if (!section) return { error: 'No se pudo inicializar la sección de nutrición.' };

  const { error } = await supabaseAdmin
    .from('athlete_nutrition_evaluation')
    .upsert(
      { diagnostic_section_id: section.id, athlete_id: athleteId, ...extractNutritionPayload(formData) },
      { onConflict: 'diagnostic_section_id' },
    );

  if (error) return { error: error.message };

  await updateSectionStatus(section.id, section.diagnostic_id, athleteId, complete);
  await logAction(athleteId, section.diagnostic_id, 'nutricion', complete ? 'rubro_completado' : 'borrador_guardado');

  revalidatePath(`/athletes/${athleteId}/diagnostic`);
  revalidatePath(`/athletes/${athleteId}`);
  return { error: null };
}

// ---------------------------------------------------------------------------
// Rubro Psicología
// ---------------------------------------------------------------------------

function extractPsychologyPayload(formData: FormData) {
  return {
    sport_psychological_interview:    str(formData, 'sport_psychological_interview'),
    competitive_anxiety_inventory:    str(formData, 'competitive_anxiety_inventory'),
    sport_motivation_scale:           str(formData, 'sport_motivation_scale'),
    resilience_scale:                 str(formData, 'resilience_scale'),
    emotional_regulation:             str(formData, 'emotional_regulation'),
    internal_motivation:              str(formData, 'internal_motivation'),
    external_motivation:              str(formData, 'external_motivation'),
    pressure_tolerance:               str(formData, 'pressure_tolerance'),
    concentration:                    str(formData, 'concentration'),
    diagnostic_integration:           str(formData, 'diagnostic_integration'),
    visualization:                    str(formData, 'visualization'),
    self_dialogue:                    str(formData, 'self_dialogue'),
    breathing_control:                str(formData, 'breathing_control'),
    goal_setting:                     str(formData, 'goal_setting'),
    concentration_training:           str(formData, 'concentration_training'),
    goal_follow_up:                   str(formData, 'goal_follow_up'),
    practical_exercises:              str(formData, 'practical_exercises'),
    psychological_feedback:           str(formData, 'psychological_feedback'),
    quantitative_psychological_state: str(formData, 'quantitative_psychological_state'),
    quantitative_performance:         str(formData, 'quantitative_performance'),
    sport_performance_impact:         str(formData, 'sport_performance_impact'),
    observations:                     str(formData, 'observations'),
    updated_at:                       new Date().toISOString(),
  };
}

export async function savePsychologySection(
  athleteId: string,
  complete: boolean,
  formData: FormData,
): Promise<{ error: string | null }> {
  const denied = await assertPermission('edit_athletes');
  if (denied) return denied;

  const section = await ensureSectionRecord(athleteId, 'psicologia');
  if (!section) return { error: 'No se pudo inicializar la sección de psicología.' };

  const { error } = await supabaseAdmin
    .from('athlete_psychology_evaluation')
    .upsert(
      { diagnostic_section_id: section.id, athlete_id: athleteId, ...extractPsychologyPayload(formData) },
      { onConflict: 'diagnostic_section_id' },
    );

  if (error) return { error: error.message };

  await updateSectionStatus(section.id, section.diagnostic_id, athleteId, complete);
  await logAction(athleteId, section.diagnostic_id, 'psicologia', complete ? 'rubro_completado' : 'borrador_guardado');

  revalidatePath(`/athletes/${athleteId}/diagnostic`);
  revalidatePath(`/athletes/${athleteId}`);
  return { error: null };
}

// ---------------------------------------------------------------------------
// Rubro Entrenador
// ---------------------------------------------------------------------------

function extractCoachPayload(formData: FormData) {
  return {
    strength_test:            str(formData, 'strength_test'),
    power_test:               str(formData, 'power_test'),
    speed_test:               str(formData, 'speed_test'),
    endurance_test:           str(formData, 'endurance_test'),
    flexibility_test:         str(formData, 'flexibility_test'),
    technical_weaknesses:     str(formData, 'technical_weaknesses'),
    competitive_capabilities: str(formData, 'competitive_capabilities'),
    movement_efficiency:      str(formData, 'movement_efficiency'),
    body_mechanics:           str(formData, 'body_mechanics'),
    segment_alignment:        str(formData, 'segment_alignment'),
    athlete_sport_profile:    str(formData, 'athlete_sport_profile'),
    discipline_intervention:  str(formData, 'discipline_intervention'),
    season_structure:         str(formData, 'season_structure'),
    competitive_calendar:     str(formData, 'competitive_calendar'),
    performance_objectives:   str(formData, 'performance_objectives'),
    preparation_stages:       str(formData, 'preparation_stages'),
    technical_correction:     str(formData, 'technical_correction'),
    load_supervision:         str(formData, 'load_supervision'),
    competition_preparation:  str(formData, 'competition_preparation'),
    performance_analysis:     str(formData, 'performance_analysis'),
    continuous_feedback:      str(formData, 'continuous_feedback'),
    mark_monitoring:          str(formData, 'mark_monitoring'),
    plan_adjustments:         str(formData, 'plan_adjustments'),
    observations:             str(formData, 'observations'),
    updated_at:               new Date().toISOString(),
  };
}

export async function saveCoachSection(
  athleteId: string,
  complete: boolean,
  formData: FormData,
): Promise<{ error: string | null }> {
  const denied = await assertPermission('edit_athletes');
  if (denied) return denied;

  const section = await ensureSectionRecord(athleteId, 'entrenador');
  if (!section) return { error: 'No se pudo inicializar la sección de entrenador.' };

  const { error } = await supabaseAdmin
    .from('athlete_coach_evaluation')
    .upsert(
      { diagnostic_section_id: section.id, athlete_id: athleteId, ...extractCoachPayload(formData) },
      { onConflict: 'diagnostic_section_id' },
    );

  if (error) return { error: error.message };

  await updateSectionStatus(section.id, section.diagnostic_id, athleteId, complete);
  await logAction(athleteId, section.diagnostic_id, 'entrenador', complete ? 'rubro_completado' : 'borrador_guardado');

  revalidatePath(`/athletes/${athleteId}/diagnostic`);
  revalidatePath(`/athletes/${athleteId}`);
  return { error: null };
}

// ---------------------------------------------------------------------------
// Rubro Fisioterapia
// ---------------------------------------------------------------------------

function extractPhysioPayload(formData: FormData) {
  return {
    sport_antecedents:         str(formData, 'sport_antecedents'),
    previous_injuries:         str(formData, 'previous_injuries'),
    current_symptoms:          str(formData, 'current_symptoms'),
    training_loads:            str(formData, 'training_loads'),
    relevant_medical_factors:  str(formData, 'relevant_medical_factors'),
    postural_anterior:         str(formData, 'postural_anterior'),
    postural_lateral:          str(formData, 'postural_lateral'),
    postural_posterior:        str(formData, 'postural_posterior'),
    joint_range_of_motion:     str(formData, 'joint_range_of_motion'),
    strength_tests:            str(formData, 'strength_tests'),
    contractile_capacity:      str(formData, 'contractile_capacity'),
    muscle_group_performance:  str(formData, 'muscle_group_performance'),
    muscle_imbalances:         str(formData, 'muscle_imbalances'),
    joint_limitations:         str(formData, 'joint_limitations'),
    biomechanical_alterations: str(formData, 'biomechanical_alterations'),
    injury_risk:               str(formData, 'injury_risk'),
    functional_diagnosis:      str(formData, 'functional_diagnosis'),
    discipline_intervention:   str(formData, 'discipline_intervention'),
    manual_therapy:            str(formData, 'manual_therapy'),
    specific_strengthening:    str(formData, 'specific_strengthening'),
    neuromuscular_reeducation: str(formData, 'neuromuscular_reeducation'),
    mobility_exercises:        str(formData, 'mobility_exercises'),
    relapse_prevention:        str(formData, 'relapse_prevention'),
    myofascial_release:        str(formData, 'myofascial_release'),
    joint_mobilization:        str(formData, 'joint_mobilization'),
    sports_massage:            str(formData, 'sports_massage'),
    tens_electrotherapy:       str(formData, 'tens_electrotherapy'),
    therapeutic_ultrasound:    str(formData, 'therapeutic_ultrasound'),
    muscle_electrostimulation: str(formData, 'muscle_electrostimulation'),
    therapeutic_exercise:      str(formData, 'therapeutic_exercise'),
    observations:              str(formData, 'observations'),
    updated_at:                new Date().toISOString(),
  };
}

export async function savePhysioSection(
  athleteId: string,
  complete: boolean,
  formData: FormData,
): Promise<{ error: string | null }> {
  const denied = await assertPermission('edit_athletes');
  if (denied) return denied;

  const section = await ensureSectionRecord(athleteId, 'fisioterapia');
  if (!section) return { error: 'No se pudo inicializar la sección de fisioterapia.' };

  const { error } = await supabaseAdmin
    .from('athlete_physiotherapy_evaluation')
    .upsert(
      { diagnostic_section_id: section.id, athlete_id: athleteId, ...extractPhysioPayload(formData) },
      { onConflict: 'diagnostic_section_id' },
    );

  if (error) return { error: error.message };

  await updateSectionStatus(section.id, section.diagnostic_id, athleteId, complete);
  await logAction(athleteId, section.diagnostic_id, 'fisioterapia', complete ? 'rubro_completado' : 'borrador_guardado');

  revalidatePath(`/athletes/${athleteId}/diagnostic`);
  revalidatePath(`/athletes/${athleteId}`);
  return { error: null };
}

// ---------------------------------------------------------------------------
// Resultado integrado interdisciplinario
// ---------------------------------------------------------------------------

export async function saveIntegratedResult(
  athleteId: string,
  formData: FormData,
): Promise<{ error: string | null }> {
  const denied = await assertPermission('edit_athletes');
  if (denied) return denied;

  const { data: diagnostic } = await supabaseAdmin
    .from('athlete_initial_diagnostic')
    .select('id')
    .eq('athlete_id', athleteId)
    .maybeSingle();

  if (!diagnostic) return { error: 'Diagnóstico no encontrado.' };

  const payload = {
    diagnostic_id:            diagnostic.id,
    athlete_id:               athleteId,
    overall_summary:          str(formData, 'overall_summary'),
    medical_summary:          str(formData, 'medical_summary'),
    nutritional_summary:      str(formData, 'nutritional_summary'),
    psychological_summary:    str(formData, 'psychological_summary'),
    sport_profile:            str(formData, 'sport_profile'),
    physiotherapy_summary:    str(formData, 'physiotherapy_summary'),
    interdisciplinary_result: str(formData, 'interdisciplinary_result'),
    generated_at:             new Date().toISOString(),
  };

  const { error } = await supabaseAdmin
    .from('athlete_integrated_results')
    .upsert(payload, { onConflict: 'diagnostic_id' });

  if (error) return { error: error.message };

  // Actualizar también el campo summary en el diagnóstico principal
  await supabaseAdmin
    .from('athlete_initial_diagnostic')
    .update({
      integrated_result: str(formData, 'interdisciplinary_result'),
      updated_at:        new Date().toISOString(),
    })
    .eq('id', diagnostic.id);

  await logAction(athleteId, diagnostic.id, 'resultado_integrado', 'resultado_generado');

  revalidatePath(`/athletes/${athleteId}/diagnostic`);
  revalidatePath(`/athletes/${athleteId}`);
  return { error: null };
}
