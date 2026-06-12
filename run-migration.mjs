/**
 * run-migration.mjs
 * Ejecuta la migración 011_initial_diagnostic.sql en Supabase
 * Uso: node run-migration.mjs
 *
 * Estrategia: usa el endpoint de la Management API de Supabase
 * POST https://api.supabase.com/v1/projects/{ref}/database/query
 * con un Personal Access Token (SUPABASE_ACCESS_TOKEN).
 *
 * Si no hay PAT, intenta ejecutar vía pg/postgres directo usando DATABASE_URL.
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── Leer .env.local ─────────────────────────────────────────────────────────
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

const SUPABASE_URL           = env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY   = env.SUPABASE_SERVICE_ROLE_KEY || '';
const SUPABASE_ACCESS_TOKEN  = env.SUPABASE_ACCESS_TOKEN || process.env.SUPABASE_ACCESS_TOKEN || '';
const DATABASE_URL           = env.DATABASE_URL || env.POSTGRES_URL || '';

// Extraer project ref de la URL
const projectRef = SUPABASE_URL.match(/https?:\/\/([^.]+)\.supabase\.co/)?.[1] || '';

// ─── Leer SQL de migración ────────────────────────────────────────────────────
const migrationPath = resolve(__dirname, 'supabase/migrations/011_initial_diagnostic.sql');
const migrationSql  = readFileSync(migrationPath, 'utf8');

console.log('─'.repeat(60));
console.log('  Migración 011_initial_diagnostic.sql');
console.log('─'.repeat(60));
console.log(`  Project ref  : ${projectRef || '(no detectado)'}`);
console.log(`  SQL size     : ${migrationSql.length} chars`);
console.log('─'.repeat(60));

// ─── Opción A: Management API con Personal Access Token ──────────────────────
async function runViaManagementApi() {
  if (!SUPABASE_ACCESS_TOKEN) throw new Error('SUPABASE_ACCESS_TOKEN no está definido.');
  if (!projectRef)            throw new Error('No se pudo detectar el project ref del URL de Supabase.');

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
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text}`);
  console.log('  ✓ Respuesta:', text.slice(0, 200));
  return true;
}

// ─── Opción B: REST API con service role (POST /rest/v1/rpc/exec_ddl) ────────
// Crea una función temporal que ejecuta DDL y la llama
async function runViaRestRpc() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) throw new Error('Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.');

  const headers = {
    'Content-Type':  'application/json',
    'apikey':        SUPABASE_SERVICE_KEY,
    'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
    'Prefer':        'return=minimal',
  };

  // Dividir la migración en sentencias individuales (split por ';' respetando bloques)
  const statements = splitSql(migrationSql);
  console.log(`\n[B] REST RPC → ${statements.length} sentencias via supabase.rpc()`);

  // Crear función auxiliar de ejecución DDL
  const createFnSql = `
    CREATE OR REPLACE FUNCTION _exec_migration_011(sql text)
    RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
    BEGIN EXECUTE sql; END;
    $$;
  `;

  const createRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/_create_exec_fn`, {
    method:  'POST',
    headers,
    body: JSON.stringify({ sql: createFnSql }),
  });
  // Ignorar el resultado (la función no existe aún; usaremos query directa)

  // Intentar vía query directa con el endpoint interno
  const queryRes = await fetch(`${SUPABASE_URL}/rest/v1/`, {
    method:  'POST',
    headers: { ...headers, 'Content-Profile': 'public' },
    body: migrationSql,
  });

  if (!queryRes.ok) throw new Error(`REST API no soporta DDL directo (HTTP ${queryRes.status})`);
  return true;
}

// ─── Opción C: node-postgres (pg) si está disponible ─────────────────────────
async function runViaPg() {
  let Client;
  try {
    const mod = await import('pg');
    Client = mod.default?.Client || mod.Client;
  } catch {
    throw new Error('Package "pg" no está instalado. Instálalo con: npm install pg');
  }

  const dbUrl = DATABASE_URL ||
    (projectRef ? `postgresql://postgres.${projectRef}:[DB_PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres` : '');

  if (!dbUrl || dbUrl.includes('[DB_PASSWORD]')) {
    throw new Error(
      'DATABASE_URL no está definido. ' +
      'Agrega DATABASE_URL=postgresql://postgres.[ref]:[password]@... en tu .env.local'
    );
  }

  console.log(`\n[C] Conectando via pg a ${dbUrl.replace(/:[^:@]*@/, ':***@')}`);
  const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
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
      // Ignorar errores de "already exists" — la migración es idempotente
      if (msg.includes('already exists') || msg.includes('IF NOT EXISTS') || msg.includes('does not exist')) {
        process.stdout.write('·');
      } else {
        console.error(`\n  ✗ Error en sentencia:\n    ${stmt.slice(0, 100)}\n    → ${msg}`);
      }
    }
  }
  await client.end();
  console.log(`\n  ✓ ${ok}/${statements.length} sentencias ejecutadas`);
  return true;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function splitSql(sql) {
  // Divide por ';' pero respeta bloques $$ ... $$
  const statements = [];
  let current = '';
  let inDollarBlock = false;

  for (const line of sql.split('\n')) {
    if (line.includes('$$')) inDollarBlock = !inDollarBlock;
    current += line + '\n';
    if (!inDollarBlock && line.trim().endsWith(';')) {
      const trimmed = current.trim();
      if (trimmed && !trimmed.startsWith('--')) statements.push(trimmed);
      current = '';
    }
  }
  if (current.trim()) statements.push(current.trim());
  return statements;
}

// ─── Ejecutar ─────────────────────────────────────────────────────────────────
(async () => {
  const strategies = [
    { name: 'Management API (PAT)', fn: runViaManagementApi },
    { name: 'node-postgres (pg)',   fn: runViaPg },
  ];

  for (const { name, fn } of strategies) {
    try {
      const ok = await fn();
      if (ok) {
        console.log(`\n✅ Migración aplicada exitosamente via ${name}`);
        process.exit(0);
      }
    } catch (e) {
      console.log(`  ↳ ${name} no disponible: ${e instanceof Error ? e.message : e}`);
    }
  }

  // Ninguna estrategia funcionó → instrucciones manuales
  console.log(`
╔════════════════════════════════════════════════════════════╗
║   No se pudo ejecutar la migración automáticamente.        ║
║                                                            ║
║   OPCIONES PARA APLICARLA MANUALMENTE:                     ║
║                                                            ║
║   1. Dashboard de Supabase (más sencillo):                  ║
║      app.supabase.com → tu proyecto → SQL Editor           ║
║      → pegar el contenido de:                              ║
║        supabase/migrations/011_initial_diagnostic.sql      ║
║      → clic en "Run"                                       ║
║                                                            ║
║   2. Supabase CLI:                                         ║
║      export SUPABASE_ACCESS_TOKEN=<tu-personal-token>      ║
║      npx supabase login                                    ║
║      npx supabase link --project-ref ${projectRef.padEnd(28)}║
║      npx supabase db push                                  ║
║                                                            ║
║   3. Variable de entorno DATABASE_URL:                      ║
║      Agrega en .env.local:                                 ║
║      DATABASE_URL=postgresql://postgres.{ref}:{pass}@...   ║
║      Luego: node run-migration.mjs                         ║
╚════════════════════════════════════════════════════════════╝
  `);
  process.exit(1);
})();
