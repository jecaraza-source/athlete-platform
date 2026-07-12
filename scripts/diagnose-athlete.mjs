/**
 * Diagnose a specific athlete account:
 *   1. Profile row (profiles table)
 *   2. RBAC roles (user_roles)
 *   3. Athlete row (athletes table)
 *   4. Calendar events (event_participants → events)
 *
 * Usage (run from apps/web/):
 *   node --env-file=.env.local scripts/diagnose-athlete.mjs boxeo20@aodeporte.com
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('❌  Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false },
});

const email = process.argv[2];
if (!email) {
  console.error('Usage: node scripts/diagnose-athlete.mjs <email>');
  process.exit(1);
}

async function main() {
  console.log(`\n🔍  Diagnosing account: ${email}\n`);

  // ── 1. Auth user ────────────────────────────────────────────────────────
  const { data: { users }, error: authErr } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (authErr) { console.error('Auth list error:', authErr.message); process.exit(1); }

  const authUser = users.find(u => u.email === email);
  if (!authUser) {
    console.log('❌  No Auth user found with that email. The account does not exist in Supabase Auth.');
    return;
  }
  console.log('✅  Auth user found');
  console.log(`    auth_user_id : ${authUser.id}`);
  console.log(`    confirmed    : ${authUser.email_confirmed_at ? 'yes' : 'no'}`);

  // ── 2. Profile ──────────────────────────────────────────────────────────
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, role, email')
    .eq('auth_user_id', authUser.id)
    .maybeSingle();

  if (!profile) {
    console.log('\n❌  No row in `profiles` for this auth user. That\'s why they can\'t log in properly.');
    return;
  }
  console.log('\n✅  Profile row found');
  console.log(`    profile_id   : ${profile.id}`);
  console.log(`    name         : ${profile.first_name} ${profile.last_name}`);
  console.log(`    role (legacy): ${profile.role ?? '(null)'}`);

  // ── 3. RBAC roles ────────────────────────────────────────────────────────
  const { data: userRoles } = await supabase
    .from('user_roles')
    .select('role_id, roles(code, name)')
    .eq('profile_id', profile.id);

  if (!userRoles?.length) {
    console.log('\n⚠️   No RBAC roles assigned in `user_roles` table.');
  } else {
    console.log('\n✅  RBAC roles:');
    userRoles.forEach(ur => {
      const r = Array.isArray(ur.roles) ? ur.roles[0] : ur.roles;
      console.log(`    - ${r?.code} (${r?.name})`);
    });
  }

  // ── 4. Athlete row ────────────────────────────────────────────────────────
  const { data: athleteRow } = await supabase
    .from('athletes')
    .select('id, first_name, last_name, status, discipline, disability_status')
    .eq('profile_id', profile.id)
    .maybeSingle();

  if (!athleteRow) {
    console.log('\n❌  NO ROW in `athletes` table for this profile.');
    console.log('    → This is why they don\'t appear in the /athletes menu (it queries `athletes` directly).');
    console.log('    → Admin / Athletes Setup DOES show them because it queries `profiles`/`user_roles`.');
    console.log('\n    FIX: Insert a row into `athletes` for this profile_id.');
  } else {
    console.log('\n✅  Athlete row found');
    console.log(`    athlete_id   : ${athleteRow.id}`);
    console.log(`    name         : ${athleteRow.first_name} ${athleteRow.last_name}`);
    console.log(`    status       : ${athleteRow.status}`);
    console.log(`    discipline   : ${athleteRow.discipline ?? '(null)'}`);

    // ── 5. Calendar events ──────────────────────────────────────────────────
    const { data: participations } = await supabase
      .from('event_participants')
      .select('event_id, participant_type, attendance_status, events(id, title, start_at, status)')
      .eq('participant_id', athleteRow.id)
      .order('event_id', { ascending: false });

    if (!participations?.length) {
      console.log('\n⚠️   No calendar events found for this athlete in `event_participants`.');
    } else {
      console.log(`\n✅  Calendar events (${participations.length} total):`);
      participations.slice(0, 10).forEach(p => {
        const ev = Array.isArray(p.events) ? p.events[0] : p.events;
        console.log(`    - [${ev?.status ?? '?'}] "${ev?.title ?? '?'}" — ${ev?.start_at?.slice(0, 10) ?? '?'} (attendance: ${p.attendance_status})`);
      });
      if (participations.length > 10) {
        console.log(`    ... and ${participations.length - 10} more.`);
      }
    }
  }

  console.log('\n─────────────────────────────────────────────\n');
}

main().catch(err => { console.error(err); process.exit(1); });
