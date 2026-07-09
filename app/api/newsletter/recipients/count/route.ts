// =============================================================================
// app/api/newsletter/recipients/count/route.ts
// GET — Returns the number of newsletter subscribers for a given audience,
//       and the profile list for the 'individual' picker.
//
// Query params:
//   audiencia — 'atleta' | 'coach' | 'staff' | 'all' | 'individual'
//   ids[]     — profile UUIDs for 'individual' (comma-separated string)
//   q         — optional name/email search for profile picker
//   limit     — max profiles to return for search (default 30)
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser }             from '@/lib/rbac/server';
import { supabaseAdmin }              from '@/lib/supabase-admin';
import { getProfileIdsForRoleCodes }  from '@/lib/newsletter/audience-roles';

export const runtime = 'nodejs';

// RBAC role codes (roles.code, via user_roles) → audience mapping.
// Mirrors newsletter-send/route.ts.
const AUDIENCE_ROLES: Record<string, string[]> = {
  atleta:     ['athlete', 'guardian'],
  coach:      ['coach'],
  staff:      ['super_admin', 'program_director', 'event_coordinator',
               'coach', 'medic', 'physio', 'psychologist', 'nutritionist'],
  all:        [],        // empty = no role filter
  individual: [],        // uses explicit ids
};

export async function GET(req: NextRequest): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user?.profile) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const audiencia = searchParams.get('audiencia') ?? 'all';
  const idsParam  = searchParams.get('ids') ?? '';
  const q         = searchParams.get('q')?.trim() ?? '';
  const limit     = Math.min(parseInt(searchParams.get('limit') ?? '30', 10), 100);

  // ── Profile search for individual picker ──────────────────────────────────
  if (audiencia === 'individual' && q.length >= 2) {
    const { data: matches } = await supabaseAdmin
      .from('profiles')
      .select('id, first_name, last_name, email, role')
      .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%`)
      .eq('newsletter_enabled', true)
      .order('first_name', { ascending: true })
      .limit(limit);

    return NextResponse.json({ count: 0, profiles: matches ?? [] });
  }

  // ── Count for a pre-selected individual list ───────────────────────────────
  if (audiencia === 'individual') {
    const ids = idsParam ? idsParam.split(',').filter(Boolean) : [];

    if (ids.length === 0) {
      return NextResponse.json({ count: 0, profiles: [] });
    }

    const { data: selected } = await supabaseAdmin
      .from('profiles')
      .select('id, first_name, last_name, email, role')
      .in('id', ids)
      .eq('newsletter_enabled', true);

    return NextResponse.json({ count: selected?.length ?? 0, profiles: selected ?? [] });
  }

  // ── Count by audience role ─────────────────────────────────────────────────
  const roles = AUDIENCE_ROLES[audiencia] ?? [];

  let query = supabaseAdmin
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .eq('newsletter_enabled', true);

  if (roles.length > 0) {
    const profileIds = await getProfileIdsForRoleCodes(roles);
    if (profileIds.length === 0) {
      return NextResponse.json({ count: 0, profiles: [] });
    }
    query = query.in('id', profileIds);
  }

  const { count, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ count: count ?? 0, profiles: [] });
}
