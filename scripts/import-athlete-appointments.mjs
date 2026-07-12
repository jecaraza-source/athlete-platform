/**
 * Importa las citas de un atleta desde el Excel de calendario al sistema.
 *
 * Para cada fila del Excel correspondiente al atleta:
 *   1. Convierte fecha/hora (horario MX) a UTC.
 *   2. Busca si el evento ya existe (mismo título + start_at).
 *      - Si existe → agrega al atleta como participante (evita duplicados).
 *      - Si no existe → crea el evento y agrega al atleta como participante.
 *
 * Usage (run from apps/web/):
 *   node --env-file=.env.local scripts/import-athlete-appointments.mjs
 */

import { createClient } from '@supabase/supabase-js';

// ─── Config ─────────────────────────────────────────────────────────────────

const ATHLETE_ID   = '7d0d1b18-4c5a-4765-bbbb-9f0fa4f81652'; // Alejandro Rodriguez Mariscal
const ATHLETE_NAME = 'Alejandro Rodriguez Mariscal';

/** Raw appointments from the Excel (FECHA DD/MM/YYYY, HORARIO HH:MM, title=PROFESIONISTA, service=SERVICIO) */
const APPOINTMENTS = [
  // JUNIO
  { fecha: '08/06/2026', horario: '20:00', title: 'MÉDICO 2',       servicio: 'MÉDICO'       },
  { fecha: '09/06/2026', horario: '17:00', title: 'FISIOTERAPIA 2', servicio: 'FISIOTERAPIA' },
  { fecha: '15/06/2026', horario: '20:00', title: 'NUTRICIÓN 2',    servicio: 'NUTRICIÓN'    },
  { fecha: '22/06/2026', horario: '20:00', title: 'PSICOLOGÍA 2',   servicio: 'PSICOLOGÍA'   },
  // JULIO
  { fecha: '01/07/2026', horario: '17:00', title: 'FISIOTERAPIA 2', servicio: 'FISIOTERAPIA' },
  { fecha: '06/07/2026', horario: '20:00', title: 'MÉDICO 2',       servicio: 'MÉDICO'       },
  { fecha: '13/07/2026', horario: '20:00', title: 'NUTRICIÓN 2',    servicio: 'NUTRICIÓN'    },
  { fecha: '20/07/2026', horario: '20:00', title: 'PSICOLOGÍA 2',   servicio: 'PSICOLOGÍA'   },
  // AGOSTO
  { fecha: '03/08/2026', horario: '17:00', title: 'FISIOTERAPIA 2', servicio: 'FISIOTERAPIA' },
  { fecha: '10/08/2026', horario: '20:00', title: 'MÉDICO 2',       servicio: 'MÉDICO'       },
  { fecha: '17/08/2026', horario: '20:00', title: 'NUTRICIÓN 2',    servicio: 'NUTRICIÓN'    },
  { fecha: '24/08/2026', horario: '20:00', title: 'PSICOLOGÍA 2',   servicio: 'PSICOLOGÍA'   },
  // SEPTIEMBRE
  { fecha: '01/09/2026', horario: '17:00', title: 'FISIOTERAPIA 2', servicio: 'FISIOTERAPIA' },
  { fecha: '07/09/2026', horario: '20:00', title: 'MÉDICO 2',       servicio: 'MÉDICO'       },
  { fecha: '14/09/2026', horario: '20:00', title: 'NUTRICIÓN 2',    servicio: 'NUTRICIÓN'    },
  { fecha: '21/09/2026', horario: '20:00', title: 'PSICOLOGÍA 2',   servicio: 'PSICOLOGÍA'   },
  // OCTUBRE (CDT = UTC-5 hasta el último domingo, el 25 oct 2026 → todas las fechas aquí son CDT)
  { fecha: '01/10/2026', horario: '17:00', title: 'FISIOTERAPIA 2', servicio: 'FISIOTERAPIA' },
  { fecha: '05/10/2026', horario: '20:00', title: 'MÉDICO 2',       servicio: 'MÉDICO'       },
  { fecha: '12/10/2026', horario: '20:00', title: 'NUTRICIÓN 2',    servicio: 'NUTRICIÓN'    },
  { fecha: '19/10/2026', horario: '20:00', title: 'PSICOLOGÍA 2',   servicio: 'PSICOLOGÍA'   },
  // NOVIEMBRE (CST = UTC-6)
  { fecha: '02/11/2026', horario: '17:00', title: 'FISIOTERAPIA 2', servicio: 'FISIOTERAPIA' },
  { fecha: '09/11/2026', horario: '20:00', title: 'MÉDICO 2',       servicio: 'MÉDICO'       },
  { fecha: '16/11/2026', horario: '20:00', title: 'NUTRICIÓN 2',    servicio: 'NUTRICIÓN'    },
  { fecha: '23/11/2026', horario: '20:00', title: 'PSICOLOGÍA 2',   servicio: 'PSICOLOGÍA'   },
  // DICIEMBRE (CST = UTC-6)
  { fecha: '01/12/2026', horario: '20:00', title: 'PSICOLOGÍA 2',   servicio: 'PSICOLOGÍA'   },
  { fecha: '02/12/2026', horario: '17:00', title: 'FISIOTERAPIA 2', servicio: 'FISIOTERAPIA' },
  { fecha: '07/12/2026', horario: '20:00', title: 'MÉDICO 2',       servicio: 'MÉDICO'       },
  { fecha: '14/12/2026', horario: '20:00', title: 'NUTRICIÓN 2',    servicio: 'NUTRICIÓN'    },
];

// ─── Service → event_type mapping
// Valid values (events_event_type_check constraint):
//   training | competition | meeting | medical | evaluation | other
const SERVICE_TO_TYPE = {
  'MÉDICO':       'medical',
  'FISIOTERAPIA': 'medical',
  'NUTRICIÓN':    'medical',
  'PSICOLOGÍA':   'medical',
};

// ─── Timezone helpers ────────────────────────────────────────────────────────
// Mexico City: CDT (UTC-5) April–October, CST (UTC-6) November–March.
// DST 2026: ends last Sunday of October = Oct 25, 2026.
// All our dates: Jun–Oct (before Oct 25) → CDT = UTC-5; Nov–Dec → CST = UTC-6.
function mxToUTC(fecha, horario) {
  const [dd, mm, yyyy] = fecha.split('/');
  const month = parseInt(mm, 10);
  const day   = parseInt(dd, 10);
  // October: CDT ends Oct 25 → Oct 1/5/12/19 are still CDT
  const isCDT = month >= 4 && month <= 10 && !(month === 10 && day >= 26);
  const offsetHours = isCDT ? -5 : -6;
  const offsetStr = `${offsetHours < 0 ? '-' : '+'}${String(Math.abs(offsetHours)).padStart(2, '0')}:00`;
  return new Date(`${yyyy}-${mm}-${dd}T${horario}:00${offsetStr}`).toISOString();
}

// ─── Main ────────────────────────────────────────────────────────────────────

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('❌  Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false },
});

async function main() {
  console.log(`\n📅  Importing ${APPOINTMENTS.length} appointments for ${ATHLETE_NAME}\n`);

  // Find an existing creator profile for "MÉDICO 2" events to keep consistency
  let defaultCreatorId = null;
  const { data: sampleEvent } = await supabase
    .from('events')
    .select('created_by_profile_id')
    .eq('title', 'MÉDICO 2')
    .not('created_by_profile_id', 'is', null)
    .limit(1)
    .maybeSingle();
  if (sampleEvent?.created_by_profile_id) {
    defaultCreatorId = sampleEvent.created_by_profile_id;
    console.log(`ℹ️   Using existing creator profile: ${defaultCreatorId}\n`);
  } else {
    console.log('ℹ️   No existing creator found — events will have null created_by_profile_id\n');
  }

  let created = 0;
  let reused  = 0;
  let linked  = 0;
  let skipped = 0;
  let errors  = 0;

  for (const appt of APPOINTMENTS) {
    const startAt = mxToUTC(appt.fecha, appt.horario);
    const endAt   = new Date(new Date(startAt).getTime() + 60 * 60 * 1000).toISOString(); // +1h
    const label   = `${appt.title} | ${appt.fecha} ${appt.horario}`;

    // 1. Check if event already exists (same title + minute-window)
    const windowStart = startAt;
    const windowEnd   = new Date(new Date(startAt).getTime() + 59 * 1000).toISOString();

    const { data: existingEvents } = await supabase
      .from('events')
      .select('id')
      .eq('title', appt.title)
      .gte('start_at', windowStart)
      .lte('start_at', windowEnd);

    let eventId;

    if (existingEvents && existingEvents.length > 0) {
      eventId = existingEvents[0].id;
      reused++;
      process.stdout.write(`  ♻️  Reusing event  ${label}\n`);
    } else {
      // Create new event
      const { data: newEvent, error: evErr } = await supabase
        .from('events')
        .insert({
          title:                  appt.title,
          event_type:             SERVICE_TO_TYPE[appt.servicio] ?? 'medico',
          start_at:               startAt,
          end_at:                 endAt,
          status:                 'scheduled',
          created_by_profile_id:  defaultCreatorId,
        })
        .select('id')
        .single();

      if (evErr) {
        console.error(`  ❌  Error creating event ${label}: ${evErr.message}`);
        errors++;
        continue;
      }
      eventId = newEvent.id;
      created++;
      process.stdout.write(`  ✅  Created event   ${label}\n`);
    }

    // 2. Check if participant already exists
    const { data: existingPart } = await supabase
      .from('event_participants')
      .select('id')
      .eq('event_id', eventId)
      .eq('participant_id', ATHLETE_ID)
      .maybeSingle();

    if (existingPart) {
      process.stdout.write(`      ↳ already linked\n`);
      skipped++;
      continue;
    }

    // 3. Add participant
    const { error: partErr } = await supabase
      .from('event_participants')
      .insert({
        event_id:          eventId,
        participant_id:    ATHLETE_ID,
        participant_type:  'athlete',
        attendance_status: 'planned',
      });

    if (partErr) {
      console.error(`      ❌  Error linking participant: ${partErr.message}`);
      errors++;
    } else {
      process.stdout.write(`      ↳ linked as participant ✅\n`);
      linked++;
    }
  }

  console.log(`
─────────────────────────────────────────────
  Events created   : ${created}
  Events reused    : ${reused}
  Participants added: ${linked}
  Already linked   : ${skipped}
  Errors           : ${errors}
─────────────────────────────────────────────
`);

  if (errors > 0) process.exit(1);
}

main().catch(err => { console.error(err); process.exit(1); });
