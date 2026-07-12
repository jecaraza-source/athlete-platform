// =============================================================================
// app/api/newsletter/recipients/list/route.ts
// GET — Returns all profiles available as newsletter recipients.
//
// Query params:
//   segments — comma-separated: staff,coach,atleta,all (default: all)
//   q        — name/email search (min 1 char)
//   limit    — max results (default 200, max 500)
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser }             from '@/lib/rbac/server';
import { supabaseAdmin }              from '@/lib/supabase-admin';
import { getProfileIdsForRoleCodes }  from '@/lib/newsletter/audience-roles';

export const runtime = 'nodejs';

// RBAC role codes (roles.code, via user_roles) — not the legacy profiles.role
// text column, which uses a different vocabulary (e.g. 'trainer' vs 'coach').
const SEGMENT_ROLES: Record<string, string[]> = {
  staff:  ['super_admin', 'program_director', 'event_coordinator',
           'medic', 'physio', 'psychologist', 'nutritionist'],
  coach:  ['coach'],
  atleta: ['athlete', 'guardian'],
};

// Resolve role list from comma-separated segments string
function rolesToQuery(segments: string): string[] | null {
  if (segments === 'all' || segments === '') return null; // no role filter = all

  const parts = segments.split(',').map((s) => s.trim()).filter(Boolean);
  const roles: string[] = [];
  for (const seg of parts) {
    const mapped = SEGMENT_ROLES[seg];
    if (mapped) roles.push(...mapped);
  }
  return roles.length > 0 ? [...new Set(roles)] : null;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user?.profile) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const segments = searchParams.get('segments') ?? 'all';
  const q        = searchParams.get('q')?.trim() ?? '';
  const limit    = Math.min(parseInt(searchParams.get('limit') ?? '200', 10), 500);

  const roles = rolesToQuery(segments);

  let query = supabaseAdmin
    .from('profiles')
    .select('id, first_name, last_name, email, role')
    .eq('newsletter_enabled', true)
    .order('first_name', { ascending: true })
    .limit(limit);

  if (roles) {
    const profileIds = await getProfileIdsForRoleCodes(roles);
    if (profileIds.length === 0) {
      return NextResponse.json({ ok: true, profiles: [], count: 0 });
    }
    query = query.in('id', profileIds);
  }

  if (q.length > 0) {
    query = query.or(
      `first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%`
    );
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok:       true,
    profiles: data ?? [],
    count:    data?.length ?? 0,
  });
}
