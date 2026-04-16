import { supabase } from '@/lib/supabase';

// =============================================================================
// Types
// =============================================================================

export type AssignedPlanType =
  | 'medical'
  | 'nutrition'
  | 'psychology'
  | 'training'
  | 'rehabilitation';

export type AssignedPlan = {
  id:           string;
  type:         AssignedPlanType;
  title:        string;
  description:  string | null;
  file_path:    string | null;
  file_name:    string | null;
  is_published: boolean;
  created_at:   string;
  updated_at:   string;
};

// =============================================================================
// Queries
// =============================================================================

/**
 * Returns all published plans assigned to this athlete.
 * RLS on the `plans` table automatically restricts results to plans that are:
 *   • is_published = true
 *   • have an athlete_plans row linking this athlete
 */
export async function getPublishedPlansForAthlete(): Promise<AssignedPlan[]> {
  const { data, error } = await supabase
    .from('plans')
    .select('id, type, title, description, file_path, file_name, is_published, created_at, updated_at')
    .eq('is_published', true)
    .order('type', { ascending: true })
    .order('created_at', { ascending: false });

  if (error) {
    // Silently return empty if table doesn't exist yet (pre-migration)
    const isMissing =
      error.message?.includes('plans') ||
      error.message?.includes('schema cache');
    if (!isMissing) console.warn('[plans] getPublishedPlansForAthlete:', error.message);
    return [];
  }

  return (data ?? []) as AssignedPlan[];
}

/**
 * Creates a signed URL (valid 1 hour) so the athlete can open the PDF.
 * Requires the "Athletes can read their plan files" storage policy.
 */
export async function getPlanFileUrl(filePath: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from('plans')
    .createSignedUrl(filePath, 60 * 60);

  if (error) {
    console.warn('[plans] getPlanFileUrl:', error.message);
    return null;
  }
  return data?.signedUrl ?? null;
}
