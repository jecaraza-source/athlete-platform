/**
 * scripts/import-karate-athletes.mjs
 *
 * Registra los 11 atletas de Karate del Excel LISTA ATLETAS KARATE_130726.xlsx
 * en Supabase: Auth user, perfil, fila athletes, diagnóstico inicial y rol RBAC.
 *
 * Uso:
 *   node --env-file=apps/web/.env.local scripts/import-karate-athletes.mjs
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl    = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌  Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const SECTION_KEYS = ['medico', 'nutricion', 'psicologia', 'entrenador', 'fisioterapia'];

const ATHLETES = [
  { firstName: 'AHXEL DANIEL',       lastName: 'TEPAL BRISEÑO',       email: 'karate146@aodeporte.com', phone: '+525539355367' },
  { firstName: 'ALONDRA ELIZABETH',  lastName: 'MENDEZ MAYEN',        email: 'karate152@aodeporte.com', phone: '+525630770190' },
  { firstName: 'ESTEFANY QUETZALLI', lastName: 'PLIEGO MALDONADO',    email: 'karate148@aodeporte.com', phone: '+525510523649' },
  { firstName: 'ZARA ABIGAIL',       lastName: 'RODRÍGUEZ RÍOS',      email: 'karate154@aodeporte.com', phone: '+525643922672' },
  { firstName: 'ALEXA ELIZABETH',    lastName: 'TAPIA GONZÁLEZ',      email: 'karate150@aodeporte.com', phone: '+525561451028' },
  { firstName: 'SARA CAMILA',        lastName: 'PEÑA CARRILLO',       email: 'karate153@aodeporte.com', phone: '+525534863402' },
  { firstName: 'DANTE ALEJANDRO',    lastName: 'OROZCO GALICIA',      email: 'karate147@aodeporte.com', phone: '+527298656361' },
  { firstName: 'SANTIAGO BENJAMIN',  lastName: 'CONTRERAS CHAVEZ',    email: 'karate149@aodeporte.com', phone: '+525572172253' },
  { firstName: 'ANTONIO FRANCISCO',  lastName: 'GARCÍA BELLO',        email: 'karate145@aodeporte.com', phone: '+525543595924' },
  { firstName: 'CARLOS ALONSO',      lastName: 'FLORES CORONA',       email: 'karate151@aodeporte.com', phone: '+525632727960' },
  { firstName: 'GABRIEL ALDAIR',     lastName: 'SOLÍS GARCÍA',        email: 'karate144@aodeporte.com', phone: '+525640300309' },
];

// ── Obtener el role_id de 'athlete' una sola vez ───────────────────────────
const { data: athleteRole } = await admin
  .from('roles')
  .select('id')
  .eq('code', 'athlete')
  .maybeSingle();

if (!athleteRole) {
  console.error('❌  No se encontró el rol "athlete" en la tabla roles.');
  process.exit(1);
}

console.log(`\n🥋  Importando ${ATHLETES.length} atletas de Karate…\n`);

let ok = 0;
let errors = 0;

for (const ath of ATHLETES) {
  const label = `${ath.firstName} ${ath.lastName}`;
  process.stdout.write(`   ${label.padEnd(34)} → `);

  // ── 1. Auth user ──────────────────────────────────────────────────────────
  let authUserId;
  const { data: created, error: authErr } = await admin.auth.admin.createUser({
    email:         ath.email,
    email_confirm: true,  // sin verificación de correo
  });

  if (authErr) {
    const alreadyExists = authErr.message.toLowerCase().includes('already');
    if (!alreadyExists) {
      console.log(`❌  Auth: ${authErr.message}`);
      errors++;
      continue;
    }
    // Ya existe — localizar su ID
    const { data: { users } } = await admin.auth.admin.listUsers({ perPage: 1000 });
    const found = users.find((u) => u.email === ath.email);
    if (!found) { console.log(`❌  No se pudo localizar usuario existente`); errors++; continue; }
    authUserId = found.id;
  } else {
    authUserId = created.user.id;
  }

  // ── 2. Perfil ─────────────────────────────────────────────────────────────
  const profileFields = {
    first_name: ath.firstName,
    last_name:  ath.lastName,
    email:      ath.email,
    phone:      ath.phone,
    role:       'athlete',
    specialty:  'Karate',
  };

  let profileId;
  const { data: existingProfile } = await admin
    .from('profiles')
    .select('id')
    .eq('auth_user_id', authUserId)
    .maybeSingle();

  if (existingProfile) {
    await admin.from('profiles').update(profileFields).eq('id', existingProfile.id);
    profileId = existingProfile.id;
  } else {
    const { data: newProfile, error: profErr } = await admin
      .from('profiles')
      .insert({ auth_user_id: authUserId, ...profileFields })
      .select('id')
      .single();
    if (profErr) { console.log(`❌  Perfil: ${profErr.message}`); errors++; continue; }
    profileId = newProfile.id;
  }

  // ── 3. Fila athletes ──────────────────────────────────────────────────────
  let athleteId;
  const { data: existingAthlete } = await admin
    .from('athletes')
    .select('id')
    .eq('profile_id', profileId)
    .maybeSingle();

  if (existingAthlete) {
    athleteId = existingAthlete.id;
  } else {
    const { data: newAthlete, error: athErr } = await admin
      .from('athletes')
      .insert({
        profile_id:        profileId,
        first_name:        ath.firstName,
        last_name:         ath.lastName,
        discipline:        'karate',
        disability_status: 'sin_discapacidad',
        status:            'active',
      })
      .select('id')
      .single();
    if (athErr) { console.log(`❌  Atleta: ${athErr.message}`); errors++; continue; }
    athleteId = newAthlete.id;
  }

  // ── 4. Diagnóstico inicial (si no existe) ─────────────────────────────────
  const { data: existingDiag } = await admin
    .from('athlete_initial_diagnostic')
    .select('id')
    .eq('athlete_id', athleteId)
    .maybeSingle();

  if (!existingDiag) {
    const { data: newDiag, error: diagErr } = await admin
      .from('athlete_initial_diagnostic')
      .insert({ athlete_id: athleteId })
      .select('id')
      .single();

    if (!diagErr && newDiag) {
      await admin.from('athlete_diagnostic_sections').insert(
        SECTION_KEYS.map((section) => ({
          diagnostic_id: newDiag.id,
          athlete_id:    athleteId,
          section,
        }))
      );
    }
  }

  // ── 5. Rol RBAC ───────────────────────────────────────────────────────────
  await admin.from('user_roles').insert({
    profile_id: profileId,
    role_id:    athleteRole.id,
  });
  // Ignorar error de duplicado — es inofensivo

  console.log('✅');
  ok++;
}

console.log(`
────────────────────────────────────────────────────────
✅  ${ok} atletas importados    ❌  ${errors} errores

Disciplina: Karate  |  Discapacidad: Sin discapacidad
Los atletas pueden iniciar sesión en https://aodeporte.com
con su correo @aodeporte.com. La primera vez deberán
usar "Olvidé mi contraseña" para establecer su clave.
────────────────────────────────────────────────────────
`);
