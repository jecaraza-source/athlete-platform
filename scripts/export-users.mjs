/**
 * export-users.mjs
 *
 * Exports a complete list of staff (profiles + roles) and athletes
 * (athletes table) to a CSV file that can be opened in Excel.
 *
 * Usage:
 *   node scripts/export-users.mjs
 *
 * Output: scripts/export-usuarios.csv (UTF-8 with BOM for Excel compatibility)
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// ---------------------------------------------------------------------------
// Load .env.local
// ---------------------------------------------------------------------------
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '../.env.local');

let supabaseUrl, serviceRoleKey;
try {
  const env = readFileSync(envPath, 'utf-8');
  for (const line of env.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const [key, ...rest] = trimmed.split('=');
    const value = rest.join('=').replace(/^["']|["']$/g, '');
    if (key === 'NEXT_PUBLIC_SUPABASE_URL')  supabaseUrl = value;
    if (key === 'SUPABASE_SERVICE_ROLE_KEY') serviceRoleKey = value;
  }
} catch {
  console.error('Could not read .env.local — make sure it exists at apps/web/.env.local');
  process.exit(1);
}

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function escapeCsv(value) {
  if (value == null) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function row(...cells) {
  return cells.map(escapeCsv).join(',');
}

// ---------------------------------------------------------------------------
// 1. Fetch staff (profiles + RBAC roles)
// ---------------------------------------------------------------------------
async function fetchStaff() {
  // Get all profiles that have at least one non-athlete role
  const { data: profiles, error: pErr } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, email, role')
    .order('last_name');

  if (pErr) throw new Error('profiles: ' + pErr.message);

  // Get RBAC role assignments for all profiles
  const { data: userRoles, error: urErr } = await supabase
    .from('user_roles')
    .select('profile_id, roles(id, code, name)');

  if (urErr) throw new Error('user_roles: ' + urErr.message);

  // Build a map: profile_id → role names[]
  const roleMap = {};
  for (const ur of userRoles ?? []) {
    const pid = ur.profile_id;
    const roleName = ur.roles?.name ?? ur.roles?.[0]?.name ?? null;
    if (roleName) {
      roleMap[pid] = roleMap[pid] ? roleMap[pid] + ' / ' + roleName : roleName;
    }
  }

  return (profiles ?? []).map((p) => ({
    tipo: 'Staff',
    nombre: `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim(),
    email: p.email ?? '',
    rol: roleMap[p.id] ?? p.role ?? '',
    disciplina_especialidad: '',
  }));
}

// ---------------------------------------------------------------------------
// 2. Fetch athletes
// ---------------------------------------------------------------------------
async function fetchAthletes() {
  const { data, error } = await supabase
    .from('athletes')
    .select('id, first_name, last_name, email, discipline, status')
    .order('last_name');

  if (error) throw new Error('athletes: ' + error.message);

  return (data ?? []).map((a) => ({
    tipo: 'Atleta',
    nombre: `${a.first_name ?? ''} ${a.last_name ?? ''}`.trim(),
    email: a.email ?? '',
    rol: 'Athlete',
    disciplina_especialidad: a.discipline ?? '',
  }));
}

// ---------------------------------------------------------------------------
// 3. Build & write CSV
// ---------------------------------------------------------------------------
async function main() {
  console.log('Conectando a Supabase...');

  const [staff, athletes] = await Promise.all([fetchStaff(), fetchAthletes()]);

  // Exclude profiles whose assigned role is Athlete/Atleta — those come from
  // the athletes table (which also carries discipline & email).
  const staffOnly = staff.filter(
    (s) => !/(atleta|athlete)/i.test(s.rol)
  );

  const allRows = [...staffOnly, ...athletes];

  const header = row('Tipo', 'Nombre Completo', 'Email', 'Rol Asignado', 'Disciplina / Especialidad');
  const lines = allRows.map((r) =>
    row(r.tipo, r.nombre, r.email, r.rol, r.disciplina_especialidad)
  );

  // UTF-8 BOM so Excel opens it correctly without garbled characters
  const bom = '\uFEFF';
  const csv = bom + [header, ...lines].join('\n');

  const outPath = resolve(__dirname, 'export-usuarios.csv');
  writeFileSync(outPath, csv, 'utf-8');

  console.log(`\n✓ Exportados: ${staffOnly.length} staff + ${athletes.length} atletas`);
  console.log(`✓ Archivo guardado en: ${outPath}`);
  console.log('\nPuedes abrirlo directamente en Excel o Google Sheets.');
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
