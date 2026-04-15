import { supabase } from '@/lib/supabase';
import type { AthleteInitialDiagnostic, AthleteSection } from '@/types';

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
