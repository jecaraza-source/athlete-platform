/**
 * scripts/test-push-notification.mjs
 *
 * Standalone test for notifyUsersNewsletterPublished.
 * Reads credentials from .env.local, resolves athlete/guardian profile IDs
 * from Supabase, and fires a OneSignal push — no dev server required.
 *
 * Usage:
 *   node scripts/test-push-notification.mjs [draftId]
 *
 * If draftId is omitted, uses the hardcoded test draft below.
 */

import { readFileSync } from 'fs';
import { resolve }      from 'path';

// ---------------------------------------------------------------------------
// 1. Load .env.local manually (no dotenv dependency needed in Node 20+)
// ---------------------------------------------------------------------------
const envPath = resolve(process.cwd(), '.env.local');
const envVars = Object.fromEntries(
  readFileSync(envPath, 'utf8')
    .split('\n')
    .filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => {
      const idx = l.indexOf('=');
      const val = l.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
      return [l.slice(0, idx).trim(), val];
    })
);

const SUPABASE_URL      = envVars.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY      = envVars.SUPABASE_SERVICE_ROLE_KEY;   // service role — bypasses RLS
const ONESIGNAL_APP_ID  = envVars.ONESIGNAL_APP_ID;
const ONESIGNAL_API_KEY = envVars.ONESIGNAL_REST_API_KEY;
const ONESIGNAL_API_URL = 'https://onesignal.com/api/v1/notifications';

const DRAFT_ID = process.argv[2] ?? '896883b6-ff58-427c-ab1d-53d97c493853';
const ASUNTO   = '🧪 Prueba de push notification';

// ---------------------------------------------------------------------------
// 2. Validate credentials
// ---------------------------------------------------------------------------
for (const [key, val] of Object.entries({ SUPABASE_URL, SUPABASE_KEY, ONESIGNAL_APP_ID, ONESIGNAL_API_KEY })) {
  if (!val) { console.error(`❌  Missing env var: ${key}`); process.exit(1); }
}

// ---------------------------------------------------------------------------
// 3. Resolve recipient profile IDs (atleta audience = athlete + guardian roles)
// ---------------------------------------------------------------------------
async function getAthleteProfileIds() {
  // Get role IDs for 'athlete' and 'guardian'
  const rolesRes = await fetch(
    `${SUPABASE_URL}/rest/v1/roles?code=in.(athlete,guardian)&select=id`,
    { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
  );
  const roles = await rolesRes.json();
  const roleIds = roles.map(r => r.id);

  if (roleIds.length === 0) {
    console.warn('⚠️  No roles found for athlete/guardian');
    return [];
  }

  // Get profiles with those roles
  const urRes = await fetch(
    `${SUPABASE_URL}/rest/v1/user_roles?role_id=in.(${roleIds.join(',')})&select=profile_id`,
    { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
  );
  const userRoles = await urRes.json();
  const profileIds = [...new Set(userRoles.map(r => r.profile_id))];

  if (profileIds.length === 0) return [];

  // Filter to newsletter_enabled = true
  const profRes = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?id=in.(${profileIds.join(',')})&newsletter_enabled=eq.true&select=id`,
    { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
  );
  const profiles = await profRes.json();
  return profiles.map(p => p.id);
}

// ---------------------------------------------------------------------------
// 4. Send OneSignal push
// ---------------------------------------------------------------------------
async function sendPush(externalIds) {
  const deepLink = `/app/newsletter/${DRAFT_ID}`;

  const body = {
    app_id:                           ONESIGNAL_APP_ID,
    include_external_user_ids:        externalIds,
    channel_for_external_user_ids:    'push',   // explicit: skip email channel
    headings: { en: '📬 Nuevo newsletter disponible', es: '📬 Nuevo newsletter disponible' },
    contents: { en: ASUNTO, es: ASUNTO },
    data:     { type: 'newsletter_published', deep_link: deepLink },
    url:      deepLink,
  };

  const res  = await fetch(ONESIGNAL_API_URL, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Basic ${ONESIGNAL_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  return { status: res.status, body: await res.json() };
}

// ---------------------------------------------------------------------------
// 5. Main
// ---------------------------------------------------------------------------
console.log('🔍  Resolving atleta profile IDs from Supabase…');
const profileIds = await getAthleteProfileIds();

console.log(`👥  Found ${profileIds.length} eligible recipient(s):`, profileIds);

if (profileIds.length === 0) {
  console.warn('⚠️  No recipients found — check newsletter_enabled flags and role assignments.');
  process.exit(0);
}

console.log('\n📤  Sending OneSignal push notification…');
const result = await sendPush(profileIds);

console.log(`\n📊  OneSignal response (HTTP ${result.status}):`);
console.log(JSON.stringify(result.body, null, 2));

if (result.status === 200 && result.body.id) {
  console.log(`\n✅  Push sent! Notification ID: ${result.body.id}`);
  console.log(`    Recipients reported by OneSignal: ${result.body.recipients ?? 'unknown'}`);
  if (result.body.recipients === 0) {
    console.warn('\n⚠️  0 recipients — users may not have the mobile app installed');
    console.warn('    or haven\'t called OneSignal.login(profile.id) yet.');
  }
} else {
  console.error('\n❌  Push failed:', result.body.errors ?? result.body);
}
