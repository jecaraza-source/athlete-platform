// =============================================================================
// services/follow-up.ts
// Follow-up module queries for the mobile app.
// Reads medical cases, nutrition plans, physio cases, and psychology cases.
//
// NOTE: These tables may not have explicit RLS SELECT policies for mobile yet.
// If a query returns an empty array unexpectedly, apply a SELECT policy
// similar to migration 014 (athletes) or 015 (push_jobs) for each table.
// Suggested policy (example for medical_cases):
//   CREATE POLICY "Authenticated users can read medical_cases"
//     ON medical_cases FOR SELECT TO authenticated USING (true);
// =============================================================================

import { supabase } from '@/lib/supabase';

// ---------------------------------------------------------------------------
// Medical
// ---------------------------------------------------------------------------

export type MedicalCase = {
  id: string;
  status: string;
  opened_at: string;
  condition: string | null;
  notes: string | null;
};

export async function listMedicalCases(
  athleteId: string,
  limit = 5,
): Promise<MedicalCase[]> {
  const { data, error } = await supabase
    .from('medical_cases')
    .select('id, status, opened_at, condition, notes')
    .eq('athlete_id', athleteId)
    .order('opened_at', { ascending: false })
    .limit(limit);
  if (error) {
    console.warn('[follow-up] listMedicalCases error:', error.message);
    return [];
  }
  return (data ?? []) as MedicalCase[];
}

// ---------------------------------------------------------------------------
// Nutrition
// ---------------------------------------------------------------------------

export type NutritionPlan = {
  id: string;
  title: string;
  start_date: string;
  end_date: string | null;
  status: string;
};

export async function listNutritionPlans(
  athleteId: string,
  limit = 5,
): Promise<NutritionPlan[]> {
  const { data, error } = await supabase
    .from('nutrition_plans')
    .select('id, title, start_date, end_date, status')
    .eq('athlete_id', athleteId)
    .order('start_date', { ascending: false })
    .limit(limit);
  if (error) {
    console.warn('[follow-up] listNutritionPlans error:', error.message);
    return [];
  }
  return (data ?? []) as NutritionPlan[];
}

// ---------------------------------------------------------------------------
// Physio
// ---------------------------------------------------------------------------

export type PhysioCase = {
  id: string;
  status: string;
  opened_at: string;
  // Supabase returns joined relations as arrays even for belongs-to relations.
  // Use injuries?.[0]?.injury_type to read the first item.
  injuries: Array<{ injury_type: string }> | null;
};

export async function listPhysioCases(
  athleteId: string,
  limit = 5,
): Promise<PhysioCase[]> {
  const { data, error } = await supabase
    .from('physio_cases')
    .select('id, status, opened_at, injuries(injury_type)')
    .eq('athlete_id', athleteId)
    .order('opened_at', { ascending: false })
    .limit(limit);
  if (error) {
    console.warn('[follow-up] listPhysioCases error:', error.message);
    return [];
  }
  return (data ?? []) as PhysioCase[];
}

// ---------------------------------------------------------------------------
// Psychology
// ---------------------------------------------------------------------------

export type PsychologyCase = {
  id: string;
  status: string;
  opened_at: string;
  summary: string | null;
};

export async function listPsychologyCases(
  athleteId: string,
  limit = 5,
): Promise<PsychologyCase[]> {
  const { data, error } = await supabase
    .from('psychology_cases')
    .select('id, status, opened_at, summary')
    .eq('athlete_id', athleteId)
    .order('opened_at', { ascending: false })
    .limit(limit);
  if (error) {
    console.warn('[follow-up] listPsychologyCases error:', error.message);
    return [];
  }
  return (data ?? []) as PsychologyCase[];
}
