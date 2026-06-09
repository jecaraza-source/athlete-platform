/**
 * scripts/reset-athlete-passwords.mjs
 *
 * One-time script: resets all athlete user passwords to a temporary value.
 * Athletes can log in with the new password and change it from their profile.
 *
 * Usage:
 *   node --env-file=.env.local scripts/reset-athlete-passwords.mjs
 */

import { createClient } from '@supabase/supabase-js';

const TEMP_PASSWORD = '12345678';

const supabaseUrl      = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey   = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌  Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.');
  process.exit(1);
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  console.log('🔍  Fetching athlete profiles…');

  // Get all profiles that have the "athlete" role assigned.
  // profiles.auth_user_id is the Supabase Auth UUID (≠ profiles.id).
  const { data: athleteProfiles, error: profilesError } = await admin
    .from('profiles')
    .select('id, auth_user_id, first_name, last_name, email')
    .eq('role', 'athlete');

  if (profilesError) {
    console.error('❌  Error fetching profiles:', profilesError.message);
    process.exit(1);
  }

  if (!athleteProfiles || athleteProfiles.length === 0) {
    // Fallback: try via user_roles join
    console.log('   No results from role column — trying user_roles join…');
    const { data: joined, error: joinError } = await admin
      .from('user_roles')
      .select('profile_id, profiles(id, auth_user_id, first_name, last_name, email), roles(code)')
      .eq('roles.code', 'athlete');

    if (joinError) {
      console.error('❌  Error fetching via user_roles:', joinError.message);
      process.exit(1);
    }

    const mapped = (joined ?? [])
      .filter(r => r.roles?.code === 'athlete' && r.profiles)
      .map(r => r.profiles);

    if (mapped.length === 0) {
      console.log('⚠️   No athletes found. Nothing to do.');
      return;
    }

    await resetPasswords(mapped);
    return;
  }

  await resetPasswords(athleteProfiles);
}

async function resetPasswords(profiles) {
  console.log(`\n🔐  Resetting passwords for ${profiles.length} athlete(s)…\n`);

  let ok = 0;
  let fail = 0;

  for (const profile of profiles) {
    const fullName = `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim();

    // Use auth_user_id (the Supabase Auth UUID) — not the internal profile.id
    const authId = profile.auth_user_id;
    if (!authId) {
      console.log(`  ⚠️   ${fullName} (${profile.email ?? profile.id}) — no auth_user_id, skipping`);
      fail++;
      continue;
    }

    const { data, error } = await admin.auth.admin.updateUserById(
      authId,
      { password: TEMP_PASSWORD }
    );

    if (error) {
      console.log(`  ❌  ${fullName} (${profile.email ?? profile.id}) — ${error.message}`);
      fail++;
    } else {
      console.log(`  ✅  ${fullName} (${profile.email ?? profile.id})`);
      ok++;
    }
  }

  console.log(`\n✔  Done — ${ok} updated, ${fail} failed.\n`);
  if (fail > 0) process.exit(1);
}

main().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
