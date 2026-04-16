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
 *
 * Defense-in-depth strategy:
 *   1. If `athleteId` is provided, explicitly filter through the `athlete_plans`
 *      junction table — independent of RLS configuration.
 *   2. Falls back to a plain query that relies entirely on RLS when no
 *      `athleteId` is available (e.g. during initial load before auth resolves).
 *
 * RLS on `plans` further restricts results to:
 *   • is_published = true
 *   • rows with an athlete_plans entry linking the current user
 */
export async function getPublishedPlansForAthlete(
  athleteId?: string | null,
): Promise<AssignedPlan[]> {
  // ── Path 1: explicit athlete filter (preferred) ────────────────────────
  if (athleteId) {
    // Fetch plan IDs assigned to this specific athlete via the junction table.
    // This is intentionally a separate query so the filter is database-enforced
    // regardless of RLS policy state.
    const { data: apRows, error: apError } = await supabase
      .from('athlete_plans')
      .select('plan_id')
      .eq('athlete_id', athleteId);

    if (apError) {
      console.warn('[plans] getPublishedPlansForAthlete (athlete_plans):', apError.message);
      // Fall through to RLS-only path below
    } else {
      const planIds = (apRows ?? []).map((r: { plan_id: string }) => r.plan_id);
      if (planIds.length === 0) return [];

      const { data, error } = await supabase
        .from('plans')
        .select('id, type, title, description, file_path, file_name, is_published, created_at, updated_at')
        .in('id', planIds)
        .eq('is_published', true)
        .order('type', { ascending: true })
        .order('created_at', { ascending: false });

      if (error) {
        const isMissing =
          error.message?.includes('plans') ||
          error.message?.includes('schema cache');
        if (!isMissing) console.warn('[plans] getPublishedPlansForAthlete:', error.message);
        return [];
      }
      return (data ?? []) as AssignedPlan[];
    }
  }

  // ── Path 2: RLS-only fallback (no athleteId available) ────────────────
  const { data, error } = await supabase
    .from('plans')
    .select('id, type, title, description, file_path, file_name, is_published, created_at, updated_at')
    .eq('is_published', true)
    .order('type', { ascending: true })
    .order('created_at', { ascending: false });

  if (error) {
    const isMissing =
      error.message?.includes('plans') ||
      error.message?.includes('schema cache');
    if (!isMissing) console.warn('[plans] getPublishedPlansForAthlete (rls-fallback):', error.message);
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
