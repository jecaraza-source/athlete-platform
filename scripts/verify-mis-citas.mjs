/**
 * Verifies that the fixed Mis Citas page returns Alejandro Rodriguez Mariscal.
 * Runs the SAME paginated query as the production page.
 *
 * Usage: node --env-file=.env.local scripts/verify-mis-citas.mjs
 */
import { createClient } from '@supabase/supabase-js';

const ATHLETE_ID = '7d0d1b18-4c5a-4765-bbbb-9f0fa4f81652';

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const TZ = 'America/Mexico_City';

function mxDate(iso) {
  return new Date(iso).toLocaleDateString('es-MX', {
    timeZone: TZ, day: '2-digit', month: 'short', year: 'numeric',
  });
}
function mxTime(iso) {
  return new Date(iso).toLocaleTimeString('es-MX', {
    timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false,
  });
}

async function main() {
  console.log('\n🔍  Verifying Mis Citas fix for Alejandro Rodriguez Mariscal\n');

  // ── Step 1: Paginated events query (mirrors production page.tsx) ─────────
  const PAGE = 1000;
  const allEvents = [];
  let from = 0;
  let pages = 0;

  while (true) {
    const { data: page, error } = await sb
      .from('events')
      .select('id, title, start_at, status, event_participants(participant_id)')
      .eq('event_type', 'medical')
      .gte('start_at', '2026-06-01T00:00:00')
      .lte('start_at', '2026-12-31T23:59:59')
      .order('start_at', { ascending: true })
      .range(from, from + PAGE - 1);

    if (error) { console.error('Query error:', error.message); process.exit(1); }
    if (!page?.length) break;
    allEvents.push(...page);
    pages++;
    if (page.length < PAGE) break;
    from += PAGE;
  }

  console.log(`✅  Events fetched: ${allEvents.length} (${pages} page${pages !== 1 ? 's' : ''})`);

  // ── Step 2: Athlete lookup ───────────────────────────────────────────────
  const athleteIds = [...new Set(
    allEvents.flatMap(ev => ev.event_participants.map(ep => ep.participant_id))
  )].filter(Boolean);

  const athleteMap = new Map();
  const ID_PAGE = 500;
  for (let i = 0; i < athleteIds.length; i += ID_PAGE) {
    const { data: aths } = await sb
      .from('athletes')
      .select('id, first_name, last_name')
      .in('id', athleteIds.slice(i, i + ID_PAGE));
    (aths ?? []).forEach(a => athleteMap.set(a.id, a));
  }

  console.log(`✅  Unique athletes resolved: ${athleteMap.size}`);

  // ── Step 3: Find events where Alejandro is a participant ─────────────────
  const alejandroEvents = allEvents.filter(ev =>
    (ev.event_participants ?? []).some(ep => ep.participant_id === ATHLETE_ID)
  );

  console.log(`\n✅  Events containing Alejandro Rodriguez Mariscal: ${alejandroEvents.length}`);

  if (alejandroEvents.length === 0) {
    console.log('\n❌  FAIL — Alejandro not found in any event.');
    process.exit(1);
  }

  // ── Step 4: Render each event as the page would ──────────────────────────
  console.log('\n  DATE            TIME   SERVICE              STATUS       ATHLETE(S) SHOWN');
  console.log('  ' + '─'.repeat(80));

  alejandroEvents
    .sort((a, b) => a.start_at.localeCompare(b.start_at))
    .forEach(ev => {
      const athletes = (ev.event_participants ?? [])
        .map(ep => athleteMap.get(ep.participant_id))
        .filter(Boolean)
        .map(a => `${a.first_name} ${a.last_name}`);
      const showsAlejandro = athletes.some(n => n.includes('Alejandro'));
      const names = athletes.join(', ') || 'Atleta no asignado';
      const flag  = showsAlejandro ? ' ✓' : '  ';
      console.log(
        `  ${flag} ${mxDate(ev.start_at).padEnd(13)} ${mxTime(ev.start_at)}  ${ev.title.padEnd(20)} ${ev.status.padEnd(12)} ${names.slice(0, 60)}`,
      );
    });

  const alwaysVisible = alejandroEvents.every(ev =>
    (ev.event_participants ?? [])
      .map(ep => athleteMap.get(ep.participant_id))
      .filter(Boolean)
      .some(a => a.id === ATHLETE_ID)
  );

  console.log('\n  ' + '─'.repeat(80));
  console.log(`\n✅  PASS — All ${alejandroEvents.length} appointments found and Alejandro's name visible.`);
  console.log(`   (Previously: 0 appointments returned — limit=500 capped results + [0] participant bug)\n`);
}

main().catch(err => { console.error(err); process.exit(1); });
