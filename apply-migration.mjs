/**
 * apply-migration.mjs
 * Aplica cualquier archivo SQL de migración en Supabase.
 *
 * Uso:
 *   node apply-migration.mjs supabase/migrations/023_training_sessions_mobile_policy.sql
 *
 * Estrategias (en orden):
 *   A. Management API  → requiere SUPABASE_ACCESS_TOKEN en apps/web/.env.local o .env.local
 *   B. node-postgres   → requiere DATABASE_URL en apps/web/.env.local o .env.local
 *   C. Genera PENDING_ALL.sql para pegar en el SQL Editor de Supabase
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname, basename } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── Argumento: archivo de migración ─────────────────────────────────────────
const arg = process.argv[2];
if (!arg) {
  console.error('Uso: node apply-migration.mjs <ruta-al-archivo.sql>');
  console.error('Ej:  node apply-migration.mjs supabase/migrations/023_training_sessions_mobile_policy.sql');
  process.exit(1);
}

const migrationPath = resolve(__dirname, arg);
let migrationSql;
try {
  migrationSql = readFileSync(migrationPath, 'utf8');
} catch {
  console.error(`✗ No se pudo leer: ${migrationPath}`);
  process.exit(1);
}

// ─── Cargar .env.local ────────────────────────────────────────────────────────
function loadEnv(filePath) {
  try {
    const content = readFileSync(filePath, 'utf8');
    const vars = {};
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
      vars[key] = val;
    }
    return vars;
  } catch {
    return {};
  }
}

const env = {
  ...loadEnv(resolve(__dirname, 'apps/web/.env.local')),
  ...loadEnv(resolve(__dirname, '.env.local')),
};

const SUPABASE_URL          = env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ACCESS_TOKEN = env.SUPABASE_ACCESS_TOKEN || process.env.SUPABASE_ACCESS_TOKEN || '';
const DATABASE_URL          = env.DATABASE_URL || env.POSTGRES_URL || '';
const projectRef            = SUPABASE_URL.match(/https?:\/\/([^.]+)\.supabase\.co/)?.[1] || '';
const label                 = basename(migrationPath);

console.log('─'.repeat(62));
console.log(`  Migración : ${label}`);
console.log(`  Proyecto  : ${projectRef || '(no detectado)'}`);
console.log(`  SQL       : ${migrationSql.length} chars`);
console.log('─'.repeat(62));

// ─── Helper: dividir SQL en sentencias ────────────────────────────────────────
function splitSql(sql) {
  const statements = [];
  let current = '';
  let inDollarBlock = false;
  for (const line of sql.split('\n')) {
    if (line.includes('$$')) inDollarBlock = !inDollarBlock;
    current += line + '\n';
    if (!inDollarBlock && line.trim().endsWith(';')) {
      const trimmed = current.trim();
      if (trimmed) statements.push(trimmed);
      current = '';
    }
  }
  if (current.trim()) statements.push(current.trim());
  return statements;
}

// ─── Estrategia A: Management API (PAT) ──────────────────────────────────────
async function runViaManagementApi() {
  if (!SUPABASE_ACCESS_TOKEN) throw new Error('SUPABASE_ACCESS_TOKEN no definido.');
  if (!projectRef)            throw new Error('No se detectó el project ref.');

  const url = `https://api.supabase.com/v1/projects/${projectRef}/database/query`;
  console.log(`\n[A] Management API → ${url}`);

  const res = await fetch(url, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${SUPABASE_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({ query: migrationSql }),
  });

  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 300)}`);
  console.log('  ✓ Respuesta:', text.slice(0, 200));
  return true;
}

// ─── Estrategia B: node-postgres (pg) ────────────────────────────────────────
async function runViaPg() {
  let Client;
  try {
    const mod = await import('pg');
    Client = mod.default?.Client || mod.Client;
  } catch {
    throw new Error('"pg" no instalado. Ejecuta: npm install pg -g');
  }

  if (!DATABASE_URL) throw new Error('DATABASE_URL no definido en .env.local.');

  console.log(`\n[B] node-postgres → ${DATABASE_URL.replace(/:[^:@]*@/, ':***@')}`);
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const statements = splitSql(migrationSql).filter(s => s.trim());
  let ok = 0;
  for (const stmt of statements) {
    try {
      await client.query(stmt);
      ok++;
      process.stdout.write('.');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const harmless = msg.includes('already exists') || msg.includes('does not exist') ||
        msg.includes('IF NOT EXISTS') || msg.includes('ON CONFLICT');
      process.stdout.write(harmless ? '·' : '\n');
      if (!harmless) console.error(`  ✗ ${stmt.slice(0, 120)}\n    → ${msg}`);
    }
  }
  await client.end();
  console.log(`\n  ✓ ${ok}/${statements.length} sentencias ejecutadas`);
  return true;
}

// ─── Ejecutar ─────────────────────────────────────────────────────────────────
(async () => {
  for (const { name, fn } of [
    { name: 'Management API (PAT)', fn: runViaManagementApi },
    { name: 'node-postgres (pg)',   fn: runViaPg },
  ]) {
    try {
      const ok = await fn();
      if (ok) {
        console.log(`\n✅ Migración aplicada exitosamente via ${name}\n`);
        process.exit(0);
      }
    } catch (e) {
      console.log(`  ↳ ${name} no disponible: ${e instanceof Error ? e.message : e}`);
    }
  }

  // Ninguna estrategia automática funcionó → generar archivo para pegar manualmente
  const outPath = resolve(__dirname, 'supabase/migrations/PENDING_MANUAL.sql');
  writeFileSync(outPath, migrationSql, 'utf8');

  console.log(`
╔══════════════════════════════════════════════════════════════╗
║   Aplica la migración manualmente en el SQL Editor:          ║
║                                                              ║
║   1. Ve a: https://app.supabase.com                         ║
║   2. Tu proyecto → SQL Editor → New query                   ║
║   3. Pega el contenido de:                                   ║
║        supabase/migrations/PENDING_MANUAL.sql                ║
║      (es una copia de ${label.padEnd(35)}║
║   4. Clic en "Run"                                           ║
║                                                              ║
║   ─── O configura una de estas opciones en .env.local: ───   ║
║                                                              ║
║   SUPABASE_ACCESS_TOKEN=<personal-access-token>             ║
║     → supabase.com/dashboard/account/tokens                 ║
║                                                              ║
║   DATABASE_URL=postgresql://postgres.${(projectRef || '{ref}').padEnd(24)}║
║     → Supabase → Settings → Database → Connection string    ║
╚══════════════════════════════════════════════════════════════╝
  `);
  console.log(`  📄 SQL listo en: supabase/migrations/PENDING_MANUAL.sql\n`);
  process.exit(1);
})();
