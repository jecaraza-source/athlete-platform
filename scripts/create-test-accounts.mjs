/**
 * scripts/create-test-accounts.mjs
 *
 * Crea tres cuentas de prueba en Supabase:
 *   - medico.test@aodeporte.com   → rol: medic
 *   - psicologo.test@aodeporte.com → rol: psychologist
 *   - atleta.test@aodeporte.com   → rol: athlete
 *
 * Uso:
 *   node --env-file=.env.local scripts/create-test-accounts.mjs
 *
 * Para eliminarlas después:
 *   node --env-file=.env.local scripts/create-test-accounts.mjs --delete
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

const TEST_PASSWORD = 'Prueba2026!';

const ACCOUNTS = [
  {
    email:      'medico.test@aodeporte.com',
    firstName:  'Médico',
    lastName:   'Prueba',
    roleCode:   'medic',
    specialty:  'Medicina deportiva',
  },
  {
    email:      'psicologo.test@aodeporte.com',
    firstName:  'Psicólogo',
    lastName:   'Prueba',
    roleCode:   'psychologist',
    specialty:  'Psicología deportiva',
  },
  {
    email:      'atleta.test@aodeporte.com',
    firstName:  'Atleta',
    lastName:   'Prueba',
    roleCode:   'athlete',
    specialty:  null,
  },
];

// ── Modo eliminación ──────────────────────────────────────────────────────────
if (process.argv.includes('--delete')) {
  console.log('🗑️  Eliminando cuentas de prueba…\n');
  for (const acc of ACCOUNTS) {
    const { data: { users } } = await admin.auth.admin.listUsers({ perPage: 1000 });
    const user = users.find((u) => u.email === acc.email);
    if (!user) { console.log(`   ⚠️  ${acc.email} — no encontrado`); continue; }
    await admin.auth.admin.deleteUser(user.id);
    console.log(`   ✅  ${acc.email} eliminado`);
  }
  console.log('\nListo.');
  process.exit(0);
}

// ── Creación de cuentas ───────────────────────────────────────────────────────
console.log('🔧  Creando cuentas de prueba…\n');

for (const acc of ACCOUNTS) {
  process.stdout.write(`   ${acc.email}  →  `);

  // 1. Crear (o localizar) usuario en Supabase Auth
  let authUserId;
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email:          acc.email,
    password:       TEST_PASSWORD,
    email_confirm:  true,          // skip email verification
  });

  if (createErr) {
    if (createErr.message.toLowerCase().includes('already')) {
      // Usuario ya existe — obtener su ID
      const { data: { users } } = await admin.auth.admin.listUsers({ perPage: 1000 });
      const existing = users.find((u) => u.email === acc.email);
      if (!existing) { console.log(`❌  No se pudo localizar usuario existente`); continue; }
      authUserId = existing.id;
      // Actualizar contraseña a la de prueba
      await admin.auth.admin.updateUserById(authUserId, { password: TEST_PASSWORD });
    } else {
      console.log(`❌  ${createErr.message}`);
      continue;
    }
  } else {
    authUserId = created.user.id;
  }

  // 2. Crear o actualizar perfil
  const { data: existingProfile } = await admin
    .from('profiles')
    .select('id')
    .eq('auth_user_id', authUserId)
    .maybeSingle();

  let profileId;
  if (existingProfile) {
    await admin.from('profiles').update({
      first_name: acc.firstName,
      last_name:  acc.lastName,
      email:      acc.email,
      role:       acc.roleCode,
      specialty:  acc.specialty,
    }).eq('id', existingProfile.id);
    profileId = existingProfile.id;
  } else {
    const { data: newProfile, error: profileErr } = await admin
      .from('profiles')
      .insert({
        auth_user_id: authUserId,
        first_name:   acc.firstName,
        last_name:    acc.lastName,
        email:        acc.email,
        role:         acc.roleCode,
        specialty:    acc.specialty,
      })
      .select('id')
      .single();
    if (profileErr) { console.log(`❌  Perfil: ${profileErr.message}`); continue; }
    profileId = newProfile.id;
  }

  // 3. Asignar rol RBAC
  const { data: roleRow } = await admin
    .from('roles')
    .select('id')
    .eq('code', acc.roleCode)
    .maybeSingle();

  if (roleRow) {
    await admin.from('user_roles').insert({
      profile_id: profileId,
      role_id:    roleRow.id,
    });
    // Ignorar error de duplicado — es inofensivo
  }

  // 4. Para atletas: crear fila en la tabla athletes
  if (acc.roleCode === 'athlete') {
    const { data: existingAthlete } = await admin
      .from('athletes')
      .select('id')
      .eq('profile_id', profileId)
      .maybeSingle();

    if (!existingAthlete) {
      await admin.from('athletes').insert({
        profile_id:  profileId,
        first_name:  acc.firstName,
        last_name:   acc.lastName,
        email:       acc.email,
        status:      'active',
      });
    }
  }

  console.log('✅  Creado');
}

console.log(`
────────────────────────────────────────────
✅  Cuentas de prueba listas

   📧 medico.test@aodeporte.com     🔑 ${TEST_PASSWORD}
   📧 psicologo.test@aodeporte.com  🔑 ${TEST_PASSWORD}
   📧 atleta.test@aodeporte.com     🔑 ${TEST_PASSWORD}

Para eliminarlas:
   node --env-file=.env.local scripts/create-test-accounts.mjs --delete
────────────────────────────────────────────
`);
