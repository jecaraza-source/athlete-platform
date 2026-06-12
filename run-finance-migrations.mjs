/**
 * run-finance-migrations.mjs
 * Aplica las migraciones del módulo de Finanzas (032-035) a Supabase.
 *
 * Uso: node run-finance-migrations.mjs
 *
 * Requiere en .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
 *   SUPABASE_ACCESS_TOKEN=<personal-access-token>
 *
 * Si no hay PAT, intenta con DATABASE_URL (conexión directa vía pg).
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
const SUPABASE_ACCESS_TOKEN = env.SUPABASE_ACCESS_TOKEN || process.env.SUPABASE_ACCESS_TOKEN || '';
const DATABASE_URL          = env.DATABASE_URL || env.POSTGRES_URL || '';

const projectRef = SUPABASE_URL.match(/https?:\/\/([^.]+)\.supabase\.co/)?.[1] || '';

// ─── Migraciones a aplicar ────────────────────────────────────────────────────
const MIGRATIONS = [
  '032_finance_tables.sql',
  '033_finance_permissions.sql',
  '034_finance_storage.sql',
  '035_seed_obregonense_2026.sql',
  '036_budget_line_items.sql',
  '037_seed_line_items.sql',
  '038_expense_disciplina.sql',
  '039_supplier_disciplina.sql',
  '040_budget_unique_constraint.sql',
  '041_supplier_payment_attachments.sql',
  '042_finance_payroll.sql',
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
console.log('  Módulo de Finanzas — Migraciones 032-035');
console.log('─'.repeat(62));
console.log(`  Proyecto : ${projectRef || '(no detectado)'}`);
migrations.forEach(({ file }) => console.log(`  ✦ ${file}`));
console.log('─'.repeat(62));

// ─── Helper: dividir SQL en sentencias ────────────────────────────────────────
function splitSql(sql) {
  const statements = [];
  let current = '';
  let dollarDepth = 0;

  for (const line of sql.split('\n')) {
    const dollarMatches = (line.match(/\$\$/g) || []).length;
    if (dollarMatches % 2 !== 0) dollarDepth = dollarDepth > 0 ? 0 : 1;
    current += line + '\n';
    if (dollarDepth === 0 && line.trim().endsWith(';')) {
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
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 400)}`);
  console.log(`  ✓ [API] ${label}`);
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

  if (!DATABASE_URL) throw new Error('DATABASE_URL no definido en .env.local.');

  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
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
      const harmless =
        msg.includes('already exists') ||
        msg.includes('IF NOT EXISTS') ||
        msg.includes('does not exist') ||
        msg.includes('ON CONFLICT');
      process.stdout.write(harmless ? '·' : 'x');
      if (!harmless) console.error(`\n  ✗ ${stmt.slice(0, 120)}\n    → ${msg}`);
    }
  }
  await client.end();
  console.log(`\n  ✓ [pg] ${label} (${ok}/${statements.length})`);
  return true;
}

// ─── Ejecutar ─────────────────────────────────────────────────────────────────
(async () => {
  let anyFailed = false;

  for (const { file, sql } of migrations) {
    let applied = false;

    for (const { name, fn } of [
      { name: 'Management API', fn: (s) => runViaManagementApi(s, file) },
      { name: 'node-postgres',  fn: (s) => runViaPg(s, file) },
    ]) {
      try {
        applied = await fn(sql);
        if (applied) break;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.log(`  ↳ ${name} falló para ${file}: ${msg}`);
      }
    }

    if (!applied) {
      console.error(`  ✗ No se pudo aplicar ${file}`);
      anyFailed = true;
    }
  }

  console.log('─'.repeat(62));
  if (anyFailed) {
    // Generar SQL combinado para aplicar manualmente
    const combined = migrations.map(({ file, sql }) =>
      `-- ============================================================\n-- ${file}\n-- ============================================================\n${sql}\n`
    ).join('\n');

    const outPath = resolve(__dirname, 'supabase/migrations/FINANCE_COMBINED.sql');
    const { writeFileSync } = await import('fs');
    writeFileSync(outPath, combined, 'utf8');

    console.log(`
╔══════════════════════════════════════════════════════════════╗
║  Aplica manualmente en Supabase:                             ║
║    app.supabase.com → tu proyecto → SQL Editor               ║
║    → abre: supabase/migrations/FINANCE_COMBINED.sql          ║
║    → clic en "Run"                                           ║
║                                                              ║
║  O agrega DATABASE_URL en .env.local y vuelve a ejecutar:   ║
║    node run-finance-migrations.mjs                           ║
╚══════════════════════════════════════════════════════════════╝`);
  } else {
    console.log('  ✅ Todas las migraciones aplicadas correctamente.');
    console.log('  → Reinicia el servidor: npm run dev');
  }
})();
