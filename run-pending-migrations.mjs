/**
 * run-pending-migrations.mjs
 * Aplica las migraciones pendientes 015, 016 y 017 a Supabase.
 *
 * Estrategias (en orden de preferencia):
 *   A. Management API  → requiere SUPABASE_ACCESS_TOKEN en .env.local
 *   B. node-postgres   → requiere DATABASE_URL en .env.local
 *   C. Instrucciones   → pega el SQL manualmente en el SQL Editor
 *
 * Uso: node run-pending-migrations.mjs
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

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
const SUPABASE_SERVICE_KEY  = env.SUPABASE_SERVICE_ROLE_KEY || '';
const SUPABASE_ACCESS_TOKEN = env.SUPABASE_ACCESS_TOKEN || process.env.SUPABASE_ACCESS_TOKEN || '';
const DATABASE_URL          = env.DATABASE_URL || env.POSTGRES_URL || '';

const projectRef = SUPABASE_URL.match(/https?:\/\/([^.]+)\.supabase\.co/)?.[1] || '';

// ─── Migraciones a aplicar ────────────────────────────────────────────────────
const MIGRATIONS = [
  '015_push_jobs_mobile_policy.sql',
  '016_security_improvements.sql',
  '017_protocols.sql',
];

const migrations = MIGRATIONS.map((file) => {
  const path = resolve(__dirname, 'supabase/migrations', file);
  try {
    return { file, sql: readFileSync(path, 'utf8') };
  } catch {
    console.warn(`  ⚠ No se encontró ${file} — se omite.`);
    return null;
  }
}).filter(Boolean);

console.log('─'.repeat(62));
console.log('  Migraciones pendientes');
console.log('─'.repeat(62));
console.log(`  Proyecto : ${projectRef || '(no detectado)'}`);
migrations.forEach(({ file }) => console.log(`  ✦ ${file}`));
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
      if (trimmed && !trimmed.startsWith('--')) statements.push(trimmed);
      current = '';
    }
  }
  if (current.trim()) statements.push(current.trim());
  return statements;
}

// ─── Estrategia A: Management API (PAT) ──────────────────────────────────────
async function runViaManagementApi(sql, label) {
  if (!SUPABASE_ACCESS_TOKEN) throw new Error('SUPABASE_ACCESS_TOKEN no definido.');
  if (!projectRef)            throw new Error('No se detectó el project ref.');

  const url = `https://api.supabase.com/v1/projects/${projectRef}/database/query`;
  const res = await fetch(url, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${SUPABASE_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({ query: sql }),
  });

  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 300)}`);
  console.log(`  ✓ [A] ${label}`);
  return true;
}

// ─── Estrategia B: node-postgres (pg) ────────────────────────────────────────
async function runViaPg(sql, label) {
  let Client;
  try {
    const mod = await import('pg');
    Client = mod.default?.Client || mod.Client;
  } catch {
    throw new Error('"pg" no instalado. Ejecuta: npm install pg');
  }

  const dbUrl = DATABASE_URL;
  if (!dbUrl) throw new Error('DATABASE_URL no definido en .env.local.');

  const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const statements = splitSql(sql).filter(s => s.trim());
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
      if (!harmless) {
        console.error(`\n  ✗ ${stmt.slice(0, 120)}\n    → ${msg}`);
      } else {
        process.stdout.write('·');
      }
    }
  }
  await client.end();
  console.log(`\n  ✓ [B] ${label} (${ok}/${statements.length} sentencias)`);
  return true;
}

// ─── Ejecutar ─────────────────────────────────────────────────────────────────
(async () => {
  let anyFailed = false;

  for (const { file, sql } of migrations) {
    const label = file;
    let applied = false;

    for (const { name, fn } of [
      { name: 'Management API', fn: (s, l) => runViaManagementApi(s, l) },
      { name: 'node-postgres',  fn: (s, l) => runViaPg(s, l)             },
    ]) {
      try {
        applied = await fn(sql, label);
        if (applied) break;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.log(`  ↳ ${name} no disponible para ${file}: ${msg}`);
      }
    }

    if (!applied) {
      anyFailed = true;
    }
  }

  if (anyFailed) {
    // Concatenar todas las migraciones en un solo bloque para el SQL Editor
    const combined = migrations.map(({ file, sql }) =>
      `-- ============================================================\n-- ${file}\n-- ============================================================\n${sql}\n`
    ).join('\n');

    console.log(`
╔══════════════════════════════════════════════════════════════╗
║   Aplica las migraciones manualmente en Supabase:            ║
║                                                              ║
║   app.supabase.com → tu proyecto → SQL Editor               ║
║   → pega el SQL generado en:                                 ║
║     supabase/migrations/PENDING_ALL.sql                      ║
║   → clic en "Run"                                            ║
║                                                              ║
║   O añade en .env.local:                                     ║
║   DATABASE_URL=postgresql://postgres.{ref}:{pass}@...        ║
║   SUPABASE_ACCESS_TOKEN=<tu-personal-access-token>           ║
║   Luego vuelve a ejecutar: node run-pending-migrations.mjs   ║
╚══════════════════════════════════════════════════════════════╝
    `);

    // Escribir el SQL combinado para copiar/pegar fácilmente
    const { writeFileSync } = await import('fs');
    const outPath = resolve(__dirname, 'supabase/migrations/PENDING_ALL.sql');
    writeFileSync(outPath, combined, 'utf8');
    console.log(`  📄 SQL combinado guardado en: supabase/migrations/PENDING_ALL.sql\n`);
    process.exit(1);
  }

  console.log('\n✅ Todas las migraciones aplicadas exitosamente.\n');
  process.exit(0);
})();
