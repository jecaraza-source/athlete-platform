import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase-admin';

const ALLOWED_ROLES = [
  'super_admin', 'admin', 'program_director',
  'coordinador', 'logistica', 'operaciones',
];

export async function GET() {
  try {
    // Verify session via server client (reads auth cookies)
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
    }

    // Fetch profile using service-role client (bypasses RLS)
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, role, first_name, last_name, email')
      .eq('auth_user_id', user.id)
      .single();

    if (!profile) {
      console.error('[admin/me] profile not found:', profileError?.message);
      return NextResponse.json({ error: 'no_profile' }, { status: 403 });
    }

    // Check RBAC user_roles → roles.code (service role bypasses RLS)
    const { data: userRoleRows } = await supabaseAdmin
      .from('user_roles')
      .select('roles(code)')
      .eq('profile_id', profile.id);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rbacCodes = (userRoleRows ?? []).map((r: any) =>
      Array.isArray(r.roles) ? r.roles[0]?.code : r.roles?.code
    ).filter(Boolean) as string[];

    const allCodes = [profile.role, ...rbacCodes].filter(Boolean) as string[];
    const matchedRole = allCodes.find(c => ALLOWED_ROLES.includes(c));

    // Temporary debug — remove after confirming access works
    console.log('[admin/me] profile.id:', profile.id);
    console.log('[admin/me] profile.role:', profile.role);
    console.log('[admin/me] rbacCodes:', rbacCodes);
    console.log('[admin/me] allCodes:', allCodes);
    console.log('[admin/me] matchedRole:', matchedRole);

    if (!matchedRole) {
      return NextResponse.json({ error: 'forbidden', allCodes }, { status: 403 });
    }

    const fullName = [profile.first_name, profile.last_name].filter(Boolean).join(' ') || profile.email || user.email || '';

    return NextResponse.json({
      id: profile.id,
      email: profile.email ?? user.email ?? '',
      full_name: fullName,
      role: matchedRole,
    });
  } catch (err) {
    console.error('[admin/me]', err);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
