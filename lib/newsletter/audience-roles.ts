// =============================================================================
// lib/newsletter/audience-roles.ts
// Resolves newsletter audience role codes to profile IDs via the current RBAC
// tables (user_roles + roles.code), NOT the legacy `profiles.role` text column.
//
// `profiles.role` predates the RBAC system and uses a different vocabulary
// for some roles (e.g. 'trainer' where RBAC uses 'coach'), so filtering
// newsletter recipients with `.eq('role', 'coach')` silently matches nobody.
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase-admin';

/** Resolves RBAC role codes (roles.code) to distinct profile IDs via user_roles. */
export async function getProfileIdsForRoleCodes(codes: string[]): Promise<string[]> {
  if (codes.length === 0) return [];

  const { data, error } = await supabaseAdmin
    .from('user_roles')
    .select('profile_id, roles!inner(code)')
    .in('roles.code', codes);

  if (error || !data) return [];
  return [...new Set(data.map((row) => row.profile_id as string))];
}
