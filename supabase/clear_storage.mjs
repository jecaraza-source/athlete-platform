/**
 * clear_storage.mjs
 * AO Deportes — Production launch storage cleanup
 *
 * Empties the `plans` and `athlete-files` buckets entirely, and removes
 * avatars for all users EXCEPT super_admin and ct@ct.com.
 *
 * Usage (from the project root):
 *   node supabase/clear_storage.mjs
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from
 * apps/web/.env.local (loaded automatically below).
 */

import { createRequire } from 'module'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dir = dirname(fileURLToPath(import.meta.url))
// Resolve @supabase/supabase-js from the web app where it is installed
const webRequire = createRequire(resolve(__dir, '../apps/web/') + '/')
const { createClient } = webRequire('@supabase/supabase-js')

// ---------------------------------------------------------------------------
// Load env vars from apps/web/.env.local
// ---------------------------------------------------------------------------
const envPath = resolve(__dir, '../apps/web/.env.local')

const env = Object.fromEntries(
  readFileSync(envPath, 'utf8')
    .split('\n')
    .filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => {
      const idx = l.indexOf('=')
      return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()]
    })
)

const SUPABASE_URL      = env['NEXT_PUBLIC_SUPABASE_URL']
const SERVICE_ROLE_KEY  = env['SUPABASE_SERVICE_ROLE_KEY']

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in apps/web/.env.local')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** List every object in a bucket (handles pagination). */
async function listAll(bucket, prefix = '') {
  const all = []
  let offset = 0
  const limit = 1000
  while (true) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .list(prefix, { limit, offset })
    if (error) throw error
    if (!data || data.length === 0) break
    all.push(...data)
    if (data.length < limit) break
    offset += limit
  }
  return all
}

/** Delete objects in batches of 100. */
async function deletePaths(bucket, paths) {
  if (paths.length === 0) return
  const batch = 100
  for (let i = 0; i < paths.length; i += batch) {
    const chunk = paths.slice(i, i + batch)
    const { error } = await supabase.storage.from(bucket).remove(chunk)
    if (error) throw error
    console.log(`  deleted ${chunk.length} object(s) from ${bucket}`)
  }
}

/** Empty an entire bucket. */
async function emptyBucket(bucket) {
  console.log(`\n[${bucket}] Listing objects…`)
  const objects = await listAll(bucket)
  console.log(`[${bucket}] Found ${objects.length} object(s)`)
  await deletePaths(bucket, objects.map(o => o.name))
  console.log(`[${bucket}] Done.`)
}

// ---------------------------------------------------------------------------
// Avatars: remove all except super_admin and ct@ct.com
// ---------------------------------------------------------------------------
async function clearAvatarsSelectively() {
  console.log('\n[avatars] Fetching preserved auth_user_ids…')

  // Get auth_user_ids for super_admin and ct@ct.com
  const { data: preserved, error } = await supabase
    .from('profiles')
    .select('auth_user_id, email, user_roles(roles(code))')
    .or('email.eq.ct@ct.com,user_roles.roles.code.eq.super_admin')

  // Fallback: query directly with a join via RPC isn't available in JS client,
  // so we query profiles and filter in JS.
  const { data: allProfiles, error: pErr } = await supabase
    .from('profiles')
    .select(`
      id,
      email,
      auth_user_id,
      user_roles (
        roles ( code )
      )
    `)
  if (pErr) throw pErr

  const preservedIds = new Set(
    allProfiles
      .filter(p =>
        p.email === 'ct@ct.com' ||
        p.user_roles?.some(ur => ur.roles?.code === 'super_admin')
      )
      .map(p => p.auth_user_id)
      .filter(Boolean)
  )

  console.log(`[avatars] Preserving ${preservedIds.size} account(s):`, [...preservedIds])

  console.log('[avatars] Listing objects…')
  const objects = await listAll('avatars')
  console.log(`[avatars] Found ${objects.length} object(s)`)

  const toDelete = objects
    .map(o => o.name)
    // Avatar path: {auth_user_id}/avatar.ext  — first segment is the user id
    .filter(name => {
      const userId = name.split('/')[0]
      return !preservedIds.has(userId)
    })

  console.log(`[avatars] Deleting ${toDelete.length} object(s), keeping ${objects.length - toDelete.length}`)
  await deletePaths('avatars', toDelete)
  console.log('[avatars] Done.')
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log('=== AO Deportes — Storage cleanup ===')
  console.log('Target:', SUPABASE_URL)

  await emptyBucket('plans')
  await emptyBucket('athlete-files')
  await clearAvatarsSelectively()

  console.log('\n✓ Storage cleanup complete.')
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
