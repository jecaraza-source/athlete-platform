// scripts/import-at130-calendar.mjs
// Sube las 24 citas de AT130 Alejandra Belmont Olarte al calendario de la BD.
// Ejecutar: node scripts/import-at130-calendar.mjs

const SUPA_URL = 'https://gwjnqokwchdojlcngtbi.supabase.co';
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPA_KEY) {
  console.error('ERROR: Falta la variable SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// ─── IDs confirmados desde la BD ─────────────────────────────────────────────

const ATHLETE_ID  = 'ff78d8a6-d402-421f-bbfd-d3cfa939f526'; // Alejandra Belmont Olarte

// Especialistas (slot 2) — obtenidos de eventos existentes en la BD
const SPECIALISTS = {
  'FISIOTERAPIA 2': '4f3b246e-ee59-4e70-9cfe-3192d3d4c0cc', // Astrid Uribe Herrera
  'MÉDICO 2':       'b143dd6e-27df-4676-bc08-60f1dcc22fb9', // David Cisneros Lopez
  'NUTRICIÓN 2':    'b9cc0ff8-cdd4-4e7d-b3aa-0ddaf10a6f72', // Miguel Angel Rubio Corro
  'PSICOLOGÍA 2':   '522001de-fe05-47fb-85e3-42a8a502accb', // Lucero Lopez
};

// ─── Citas (fecha local Mexico City UTC-6 → start_at UTC) ────────────────────
// Duración de cada cita: 30 minutos (convención del sistema)

function toUTC(dateDD_MM_YYYY, hourLocal) {
  // dateDD_MM_YYYY e.g. "03/07/2026", hourLocal e.g. "19:00"
  const [dd, mm, yyyy] = dateDD_MM_YYYY.split('/');
  const [hh, min] = hourLocal.split(':');
  // Create a date in UTC-6 by adding 6 hours offset
  const localMs = Date.UTC(+yyyy, +mm - 1, +dd, +hh, +min, 0);
  const utcMs   = localMs + 6 * 60 * 60 * 1000; // UTC-6 → +6h to get UTC
  return new Date(utcMs).toISOString();
}

function addMinutes(isoStr, mins) {
  return new Date(new Date(isoStr).getTime() + mins * 60_000).toISOString();
}

// Slot profesionista → título y event_type en la BD
const SLOT_CONFIG = {
  'FISIOTERAPIA 2': { title: 'FISIOTERAPIA 2', event_type: 'physio'     },
  'MÉDICO 2':       { title: 'MÉDICO 2',       event_type: 'medical'    },
  'NUTRICIÓN 2':    { title: 'NUTRICIÓN 2',    event_type: 'nutrition'  },
  'PSICOLOGÍA 2':   { title: 'PSICOLOGÍA 2',   event_type: 'psychology' },
};

const CITAS_RAW = [
  { fecha: '03/07/2026', hora: '19:00', slot: 'FISIOTERAPIA 2' },
  { fecha: '10/07/2026', hora: '20:00', slot: 'MÉDICO 2'       },
  { fecha: '17/07/2026', hora: '20:00', slot: 'NUTRICIÓN 2'    },
  { fecha: '24/07/2026', hora: '20:00', slot: 'PSICOLOGÍA 2'   },
  { fecha: '05/08/2026', hora: '19:00', slot: 'FISIOTERAPIA 2' },
  { fecha: '14/08/2026', hora: '20:00', slot: 'MÉDICO 2'       },
  { fecha: '21/08/2026', hora: '20:00', slot: 'NUTRICIÓN 2'    },
  { fecha: '28/08/2026', hora: '20:00', slot: 'PSICOLOGÍA 2'   },
  { fecha: '03/09/2026', hora: '19:00', slot: 'FISIOTERAPIA 2' },
  { fecha: '11/09/2026', hora: '20:00', slot: 'MÉDICO 2'       },
  { fecha: '18/09/2026', hora: '20:00', slot: 'NUTRICIÓN 2'    },
  { fecha: '25/09/2026', hora: '20:00', slot: 'PSICOLOGÍA 2'   },
  { fecha: '05/10/2026', hora: '19:00', slot: 'FISIOTERAPIA 2' },
  { fecha: '09/10/2026', hora: '20:00', slot: 'MÉDICO 2'       },
  { fecha: '16/10/2026', hora: '20:00', slot: 'NUTRICIÓN 2'    },
  { fecha: '23/10/2026', hora: '20:00', slot: 'PSICOLOGÍA 2'   },
  { fecha: '04/11/2026', hora: '19:00', slot: 'FISIOTERAPIA 2' },
  { fecha: '13/11/2026', hora: '20:00', slot: 'MÉDICO 2'       },
  { fecha: '20/11/2026', hora: '20:00', slot: 'NUTRICIÓN 2'    },
  { fecha: '27/11/2026', hora: '20:00', slot: 'PSICOLOGÍA 2'   },
  { fecha: '02/12/2026', hora: '19:00', slot: 'FISIOTERAPIA 2' },
  { fecha: '08/12/2026', hora: '20:00', slot: 'PSICOLOGÍA 2'   },
  { fecha: '11/12/2026', hora: '20:00', slot: 'MÉDICO 2'       },
  { fecha: '18/12/2026', hora: '20:00', slot: 'NUTRICIÓN 2'    },
];

// ─── API helpers ──────────────────────────────────────────────────────────────

const HEADERS = {
  'Content-Type':  'application/json',
  'apikey':        SUPA_KEY,
  'Authorization': `Bearer ${SUPA_KEY}`,
  'Prefer':        'return=representation',
};

async function insertEvent(event) {
  const res = await fetch(`${SUPA_URL}/rest/v1/events`, {
    method:  'POST',
    headers: HEADERS,
    body:    JSON.stringify(event),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Error insertando evento: ${res.status} ${text}`);
  }
  const data = await res.json();
  return data[0];
}

async function insertParticipant(eventId, athleteId) {
  const res = await fetch(`${SUPA_URL}/rest/v1/event_participants`, {
    method:  'POST',
    headers: HEADERS,
    body:    JSON.stringify({
      event_id:          eventId,
      participant_id:    athleteId,
      participant_type:  'athlete',
      attendance_status: 'scheduled',
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Error insertando participante: ${res.status} ${text}`);
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const sorted = [...CITAS_RAW].sort((a, b) => {
    const [da, ma, ya] = a.fecha.split('/');
    const [db, mb, yb] = b.fecha.split('/');
    return new Date(`${ya}-${ma}-${da}`) - new Date(`${yb}-${mb}-${db}`);
  });

  console.log(`\nInsertando ${sorted.length} citas para AT130 Alejandra Belmont Olarte...\n`);

  let ok = 0, err = 0;

  for (const c of sorted) {
    const startAt  = toUTC(c.fecha, c.hora);
    const endAt    = addMinutes(startAt, 30);
    const cfg      = SLOT_CONFIG[c.slot];
    const profId   = SPECIALISTS[c.slot];

    const eventPayload = {
      title:      cfg.title,
      event_type: cfg.event_type,
      start_at:               startAt,
      end_at:                 endAt,
      status:                 'scheduled',
      created_by_profile_id:  profId,
      description:            `Cita programada — AT130 Alejandra Belmont Olarte`,
    };

    try {
      const event = await insertEvent(eventPayload);
      await insertParticipant(event.id, ATHLETE_ID);
      console.log(`  ✓  ${c.fecha} ${c.hora}  ${cfg.title}`);
      ok++;
    } catch (e) {
      console.error(`  ✗  ${c.fecha} ${c.hora}  ${cfg?.title ?? c.slot}  →  ${e.message}`);
      err++;
    }
  }

  console.log(`\nResultado: ${ok} exitosas, ${err} errores.\n`);
}

main().catch((e) => { console.error(e); process.exit(1); });
