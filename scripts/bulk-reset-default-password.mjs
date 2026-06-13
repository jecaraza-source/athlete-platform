/**
 * scripts/bulk-reset-default-password.mjs
 *
 * Resets all users whose password_changed_at IS NULL to the default
 * password (12345678).  Users who changed their password via the mobile
 * app or web (tracked by the DB trigger in migration 050) are skipped
 * automatically.
 *
 * Usage:
 *   node --env-file=.env.local scripts/bulk-reset-default-password.mjs
 *
 * Dry-run (shows who would be reset without changing anything):
 *   DRY_RUN=true node --env-file=.env.local scripts/bulk-reset-default-password.mjs
 */

import { createClient } from '@supabase/supabase-js';

const DEFAULT_PASSWORD = '12345678';
const DRY_RUN         = process.env.DRY_RUN === 'true';

const supabaseUrl    = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌  Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  console.log(DRY_RUN ? '🔍  DRY RUN — no passwords will be changed\n' : '');
  console.log('🔍  Fetching profiles with default password (password_changed_at IS NULL)…\n');

  const { data: profiles, error } = await admin
    .from('profiles')
    .select('id, auth_user_id, first_name, last_name, email')
    .is('password_changed_at', null)
    .not('auth_user_id', 'is', null)
    .order('last_name');

  if (error) {
    console.error('❌  Error fetching profiles:', error.message);
    process.exit(1);
  }

  if (!profiles || profiles.length === 0) {
    console.log('✅  No users with default password found. Nothing to do.');
    return;
  }

  console.log(`Found ${profiles.length} user(s) to reset:\n`);
  profiles.forEach((p, i) => {
    const name = `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || '(sin nombre)';
    console.log(`  ${String(i + 1).padStart(3)}.  ${name.padEnd(30)}  ${p.email ?? '—'}`);
  });

  if (DRY_RUN) {
    console.log(`\n⚠️   Dry run — ${profiles.length} password(s) would be reset. Re-run without DRY_RUN=true to apply.`);
    return;
  }

  console.log(`\n🔐  Resetting ${profiles.length} password(s) to "${DEFAULT_PASSWORD}"…\n`);

  let ok   = 0;
  let fail = 0;
  const errors = [];

  // Process sequentially to avoid Supabase Auth rate-limits
  for (const profile of profiles) {
    const name = `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim() || '(sin nombre)';
    const label = `${name} (${profile.email ?? profile.id})`;

    const { error: pwErr } = await admin.auth.admin.updateUserById(
      profile.auth_user_id,
      { password: DEFAULT_PASSWORD },
    );

    if (pwErr) {
      console.log(`  ❌  ${label} — ${pwErr.message}`);
      errors.push({ label, error: pwErr.message });
      fail++;
    } else {
      console.log(`  ✅  ${label}`);
      ok++;
    }
  }

  console.log('\n' + '─'.repeat(60));
  console.log(`✔  Completado — ${ok} restablecida(s), ${fail} fallida(s).`);

  if (errors.length > 0) {
    console.log('\nErrores:');
    errors.forEach(e => console.log(`  • ${e.label}: ${e.error}`));
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
