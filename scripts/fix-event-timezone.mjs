/**
 * Corrige los timestamps de los eventos Jun–Oct de Alejandro Rodriguez Mariscal.
 *
 * Contexto: México eliminó el horario de verano (DST) en 2023.
 * Mexico City usa CST = UTC-6 todo el año.
 * El import original usó CDT = UTC-5 para meses de verano → eventos 1h adelantados.
 *
 * Fix: suma +1 hora a start_at / end_at de los 18 eventos afectados.
 *
 * Estos eventos son COMPARTIDOS (usados por varios atletas del Grupo 2),
 * por lo que corregirlos beneficia a todo el grupo.
 *
 * Usage (run from apps/web/):
 *   node --env-file=.env.local scripts/fix-event-timezone.mjs
 */
import { createClient } from '@supabase/supabase-js';

const ATHLETE_ID = '7d0d1b18-4c5a-4765-bbbb-9f0fa4f81652'; // Alejandro Rodriguez Mariscal

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceKey) { console.error('Missing env vars'); process.exit(1); }

const sb = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

function mxDate(iso) {
  return new Date(iso).toLocaleDateString('sv-SE', { timeZone: 'America/Mexico_City' });
}
function mxTime(iso) {
  return new Date(iso).toLocaleTimeString('es-MX', {
    timeZone: 'America/Mexico_City', hour: '2-digit', minute: '2-digit', hour12: false,
  });
}

async function main() {
  // 1. Fetch all of Alejandro's events
  const { data: parts, error: pErr } = await sb
    .from('event_participants')
    .select('event_id, events(id, title, start_at, end_at)')
    .eq('participant_id', ATHLETE_ID);

  if (pErr) { console.error('Fetch error:', pErr.message); process.exit(1); }

  const events = (parts ?? [])
    .map(p => Array.isArray(p.events) ? p.events[0] : p.events)
    .filter(Boolean);

  // 2. Identify the Jun–Oct events stored with CDT offset (UTC-5 instead of UTC-6).
  //    They have UTC hours 01 (for 20:00 MX) or 22 (for 17:00 MX) because the original
  //    importer used CDT=UTC-5. With CST=UTC-6, they should be at UTC 02 and UTC 23.
  const toFix = events.filter(e => {
    const month   = parseInt(mxDate(e.start_at).slice(5, 7), 10);
    const utcHour = new Date(e.start_at).getUTCHours();
    return month >= 6 && month <= 10 && (utcHour === 1 || utcHour === 22);
  });

  console.log(`\nFound ${toFix.length} events to fix (Jun–Oct, 1hr off)\n`);
  toFix.sort((a, b) => a.start_at.localeCompare(b.start_at));

  for (const e of toFix) {
    const before = `${mxDate(e.start_at)} ${mxTime(e.start_at)}`;
    const newStart = new Date(new Date(e.start_at).getTime() + 3_600_000).toISOString();
    const newEnd   = new Date(new Date(e.end_at).getTime()   + 3_600_000).toISOString();
    const after  = `${mxDate(newStart)} ${mxTime(newStart)}`;

    const { error } = await sb.from('events')
      .update({ start_at: newStart, end_at: newEnd })
      .eq('id', e.id);

    if (error) {
      console.error(`  ❌  ${e.title.padEnd(20)} ${before} → ERROR: ${error.message}`);
    } else {
      console.log(`  ✅  ${e.title.padEnd(20)} ${before} → ${after}`);
    }
  }

  // 3. Verify final state
  console.log('\n── Verificación final ───────────────────────────────────────');
  const { data: parts2 } = await sb
    .from('event_participants')
    .select('event_id, events(id, title, start_at)')
    .eq('participant_id', ATHLETE_ID);

  (parts2 ?? [])
    .map(p => Array.isArray(p.events) ? p.events[0] : p.events)
    .filter(Boolean)
    .sort((a, b) => a.start_at.localeCompare(b.start_at))
    .forEach(e => {
      console.log(`  ${mxDate(e.start_at)}  ${mxTime(e.start_at)}  ${e.title}`);
    });

  console.log('\n✔  Done\n');
}

main().catch(err => { console.error(err); process.exit(1); });
