import { supabase } from '@/lib/supabase';
import type { AthleteInitialDiagnostic, AthleteSection } from '@/types';

// ---------------------------------------------------------------------------
// Individual plans  (LEGACY — kept for backward compatibility)
//
// This module reads from `athlete_individual_plans`, the original text-based
// plan system with Spanish type keys ('medico', 'alimentario', etc.).
//
// The ACTIVE system is the `plans` table (migration 020), which stores
// structured plans with English type keys ('medical', 'nutrition', etc.)
// and supports file attachments (PDFs).  The mobile plan screen
// (app/app/(tabs)/plan.tsx) reads from `plans` via services/plans.ts.
//
// Do NOT remove these functions — they may still be used by admin tooling.
// If you need to surface individual-plan content in the UI, prefer using
// services/plans.ts (getPublishedPlansForAthlete).
// ---------------------------------------------------------------------------

export type PlanType =
  | 'medico'
  | 'alimentario'
  | 'psicologico'
  | 'entrenamiento'
  | 'rehabilitacion';

export type IndividualPlan = {
  id:           string;
  diagnostic_id: string;
  athlete_id:   string;
  plan_type:    PlanType;
  content:      string | null;
  created_at:   string;
  updated_at:   string;
};

/** Get all individual plans for an athlete (legacy system). */
export async function getIndividualPlans(athleteId: string): Promise<IndividualPlan[]> {
  const { data, error } = await supabase
    .from('athlete_individual_plans')
    .select('id, diagnostic_id, athlete_id, plan_type, content, created_at, updated_at')
    .eq('athlete_id', athleteId)
    .order('plan_type', { ascending: true });
  if (error) {
    console.warn('[diagnostic] getIndividualPlans error:', error.message);
    return [];
  }
  return (data ?? []) as IndividualPlan[];
}

// ---------------------------------------------------------------------------
// Diagnostic
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Mutations (staff-only — enforced by RLS from migration 025)
// ---------------------------------------------------------------------------

/**
 * Creates a diagnostic record for an athlete if none exists, or returns
 * the existing one. Used before updating section statuses.
 */
export async function upsertDiagnostic(
  athleteId: string,
): Promise<AthleteInitialDiagnostic | null> {
  // Try to get the existing diagnostic first
  const existing = await getDiagnosticByAthleteId(athleteId);
  if (existing) return existing;

  // Create a new baseline diagnostic
  const { data, error } = await supabase
    .from('athlete_initial_diagnostic')
    .insert({
      athlete_id:     athleteId,
      overall_status: 'pendiente',
      completion_pct: 0,
      is_baseline:    true,
      version:        1,
    })
    .select()
    .single();
  if (error) {
    console.warn('[diagnostic] upsertDiagnostic error:', error.message);
    return null;
  }
  return data as AthleteInitialDiagnostic;
}

// Forward declaration — getDiagnostic is defined below
async function getDiagnosticByAthleteId(athleteId: string) {
  const { data } = await supabase
    .from('athlete_initial_diagnostic')
    .select('*')
    .eq('athlete_id', athleteId)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data as AthleteInitialDiagnostic | null;
}

/**
 * Updates the status (and optionally the completion_pct) of a single
 * diagnostic section. If the section row doesn't exist yet, inserts it.
 *
 * Also recalculates and updates overall_status / completion_pct on the
 * parent diagnostic row.
 */
export async function updateSectionStatus(
  diagnosticId: string,
  athleteId:    string,
  section:      import('@/types').DiagnosticSectionKey,
  status:       import('@/types').DiagnosticStatus,
  pct           = 0,
): Promise<boolean> {
  // 1. Upsert the section row
  const { error: sectionError } = await supabase
    .from('athlete_diagnostic_sections')
    .upsert(
      {
        diagnostic_id:  diagnosticId,
        athlete_id:     athleteId,
        section,
        status,
        completion_pct: status === 'completo' ? 100
          : status === 'en_proceso'           ? Math.max(pct, 10)
          : status === 'requiere_atencion'    ? pct
          : 0,
        captured_at:   new Date().toISOString(),
        updated_at:    new Date().toISOString(),
      },
      { onConflict: 'diagnostic_id,section' }
    );

  if (sectionError) {
    console.warn('[diagnostic] updateSectionStatus upsert error:', sectionError.message);
    return false;
  }

  // 2. Re-read all sections to recalculate overall progress
  const { data: allSections } = await supabase
    .from('athlete_diagnostic_sections')
    .select('status, completion_pct')
    .eq('diagnostic_id', diagnosticId);

  const sections = (allSections ?? []) as { status: string; completion_pct: number }[];
  const totalSections = 5; // medico, nutricion, psicologia, entrenador, fisioterapia
  const completed = sections.filter((s) => s.status === 'completo').length;
  const avgPct    = sections.length > 0
    ? Math.round(sections.reduce((sum, s) => sum + (s.completion_pct ?? 0), 0) / totalSections)
    : 0;

  const overallStatus: import('@/types').DiagnosticStatus =
    completed === totalSections      ? 'completo'
    : sections.some((s) => s.status === 'requiere_atencion') ? 'requiere_atencion'
    : sections.some((s) => s.status === 'en_proceso' || s.status === 'completo') ? 'en_proceso'
    : 'pendiente';

  // 3. Update parent diagnostic
  const { error: diagError } = await supabase
    .from('athlete_initial_diagnostic')
    .update({
      overall_status:  overallStatus,
      completion_pct:  avgPct,
      completed_at:    completed === totalSections ? new Date().toISOString() : null,
    })
    .eq('id', diagnosticId);

  if (diagError) {
    console.warn('[diagnostic] updateSectionStatus overall update error:', diagError.message);
  }

  return true;
}

/** Get the latest diagnostic for an athlete. */
export async function getDiagnostic(athleteId: string): Promise<AthleteInitialDiagnostic | null> {
  const { data, error } = await supabase
    .from('athlete_initial_diagnostic')        // singular – matches DB schema
    .select('*')
    .eq('athlete_id', athleteId)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as AthleteInitialDiagnostic | null;
}

/** Get all sections for a diagnostic. */
export async function getDiagnosticSections(diagnosticId: string): Promise<AthleteSection[]> {
  const { data, error } = await supabase
    .from('athlete_diagnostic_sections')       // matches DB schema
    .select('*')
    .eq('diagnostic_id', diagnosticId)
    .order('section', { ascending: true });
  if (error) throw error;
  return (data ?? []) as AthleteSection[];
}

/** Get the diagnostic sections for an athlete (by athlete_id, not diagnostic_id). */
export async function getSectionsByAthleteId(athleteId: string): Promise<AthleteSection[]> {
  const { data, error } = await supabase
    .from('athlete_diagnostic_sections')
    .select('*')
    .eq('athlete_id', athleteId)
    .order('section', { ascending: true });
  if (error) throw error;
  return (data ?? []) as AthleteSection[];
}

/** Get medical evaluation data for a section. */
export async function getMedicalEvaluation(sectionId: string) {
  const { data, error } = await supabase
    .from('athlete_medical_evaluation')        // matches DB schema
    .select('*')
    .eq('diagnostic_section_id', sectionId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Get nutrition evaluation data for a section. */
export async function getNutritionEvaluation(sectionId: string) {
  const { data, error } = await supabase
    .from('athlete_nutrition_evaluation')      // matches DB schema
    .select('*')
    .eq('diagnostic_section_id', sectionId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Get psychology evaluation data for a section. */
export async function getPsychologyEvaluation(sectionId: string) {
  const { data, error } = await supabase
    .from('athlete_psychology_evaluation')
    .select('*')
    .eq('diagnostic_section_id', sectionId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Get coach evaluation data for a section. */
export async function getCoachEvaluation(sectionId: string) {
  const { data, error } = await supabase
    .from('athlete_coach_evaluation')
    .select('*')
    .eq('diagnostic_section_id', sectionId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Get physiotherapy evaluation data for a section. */
export async function getPhysioEvaluation(sectionId: string) {
  const { data, error } = await supabase
    .from('athlete_physiotherapy_evaluation')  // matches DB schema
    .select('*')
    .eq('diagnostic_section_id', sectionId)
    .maybeSingle();
  if (error) throw error;
  return data;
}
