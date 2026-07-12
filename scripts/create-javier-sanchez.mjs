/**
 * scripts/create-javier-sanchez.mjs
 *
 * Crea el usuario José Javier Sánchez Ramírez con rol 'auditor'.
 * Acceso: calendario de citas, planes, protocolos.
 * Sin acceso a: perfiles de atletas, finanzas, panel de administración.
 *
 * Uso (ejecutar DESPUÉS de aplicar la migración 061_auditor_role.sql):
 *   node --env-file=.env.local scripts/create-javier-sanchez.mjs
 *
 * Para eliminarlo:
 *   node --env-file=.env.local scripts/create-javier-sanchez.mjs --delete
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

const USER = {
  email:     'javier.sanchezramirez67@gmail.com',
  firstName: 'José Javier',
  lastName:  'Sánchez Ramírez',
  phone:     '+525512975585',
  roleCode:  'auditor',
  // Contraseña temporal — deberá cambiarla en su primer inicio de sesión
  password:  '12345678',
};

// ── Modo eliminación ───────────────────────────────────────────────────────────
if (process.argv.includes('--delete')) {
  console.log('🗑️  Eliminando usuario…\n');
  const { data: { users } } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const found = users.find((u) => u.email === USER.email);
  if (!found) {
    console.log(`⚠️  ${USER.email} — no encontrado`);
  } else {
    await admin.auth.admin.deleteUser(found.id);
    console.log(`✅  ${USER.email} eliminado`);
  }
  process.exit(0);
}

// ── Creación de usuario ────────────────────────────────────────────────────────
console.log(`🔧  Creando usuario: ${USER.firstName} ${USER.lastName}\n`);

// 1. Crear (o localizar) usuario en Supabase Auth
let authUserId;
const { data: created, error: createErr } = await admin.auth.admin.createUser({
  email:         USER.email,
  password:      USER.password,
  email_confirm: true,   // sin verificación por correo
});

if (createErr) {
  if (createErr.message.toLowerCase().includes('already')) {
    const { data: { users } } = await admin.auth.admin.listUsers({ perPage: 1000 });
    const existing = users.find((u) => u.email === USER.email);
    if (!existing) {
      console.error(`❌  No se pudo localizar el usuario existente`);
      process.exit(1);
    }
    authUserId = existing.id;
    console.log(`   ℹ️  Auth user ya existía — reutilizando`);
  } else {
    console.error(`❌  Auth: ${createErr.message}`);
    process.exit(1);
  }
} else {
  authUserId = created.user.id;
  console.log(`   ✅  Auth user creado: ${authUserId}`);
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
    first_name: USER.firstName,
    last_name:  USER.lastName,
    email:      USER.email,
    phone:      USER.phone,
    role:       null,   // rol legacy vacío; se usa RBAC moderno
  }).eq('id', existingProfile.id);
  profileId = existingProfile.id;
  console.log(`   ✅  Perfil actualizado: ${profileId}`);
} else {
  const { data: newProfile, error: profileErr } = await admin
    .from('profiles')
    .insert({
      auth_user_id: authUserId,
      first_name:   USER.firstName,
      last_name:    USER.lastName,
      email:        USER.email,
      phone:        USER.phone,
      role:         null,
    })
    .select('id')
    .single();

  if (profileErr) {
    console.error(`❌  Perfil: ${profileErr.message}`);
    process.exit(1);
  }
  profileId = newProfile.id;
  console.log(`   ✅  Perfil creado: ${profileId}`);
}

// 3. Asignar rol RBAC 'auditor'
const { data: roleRow, error: roleErr } = await admin
  .from('roles')
  .select('id')
  .eq('code', USER.roleCode)
  .maybeSingle();

if (!roleRow) {
  console.error(`❌  Rol '${USER.roleCode}' no encontrado. ¿Se aplicó la migración 061_auditor_role.sql?`);
  process.exit(1);
}

const { error: assignErr } = await admin.from('user_roles').insert({
  profile_id: profileId,
  role_id:    roleRow.id,
});

if (assignErr && !assignErr.message.includes('duplicate')) {
  console.error(`❌  Asignación de rol: ${assignErr.message}`);
  process.exit(1);
}

console.log(`   ✅  Rol '${USER.roleCode}' asignado`);

console.log(`
────────────────────────────────────────────
✅  Usuario creado exitosamente

   👤 ${USER.firstName} ${USER.lastName}
   📧 ${USER.email}
   📱 ${USER.phone}
   🔑 Contraseña temporal: ${USER.password}
   🎭 Rol: ${USER.roleCode}

   Acceso:
     ✅ Calendario de citas (/calendar, /medical/appointments)
     ✅ Planes (/plans)
     ✅ Protocolos (/protocols)
     ❌ Perfiles de atletas
     ❌ Seguimiento clínico (follow-up)
     ❌ Finanzas
     ❌ Panel de administración

Para eliminarlo:
   node --env-file=.env.local scripts/create-javier-sanchez.mjs --delete
────────────────────────────────────────────
`);
