/**
 * verify-migration.mjs — Verifica que la migración 011 se aplicó correctamente
 */
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

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
  } catch { return {}; }
}

const env = {
  ...loadEnv(resolve(__dirname, 'apps/web/.env.local')),
  ...loadEnv(resolve(__dirname, '.env.local')),
};

const SUPABASE_URL    = env.NEXT_PUBLIC_SUPABASE_URL || '';
const SERVICE_KEY     = env.SUPABASE_SERVICE_ROLE_KEY || '';
const ACCESS_TOKEN    = env.SUPABASE_ACCESS_TOKEN || process.env.SUPABASE_ACCESS_TOKEN || '';
const projectRef      = SUPABASE_URL.match(/https?:\/\/([^.]+)\.supabase\.co/)?.[1] || '';

async function query(sql) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ACCESS_TOKEN}` },
    body: JSON.stringify({ query: sql }),
  });
  const text = await res.text();
  try { return JSON.parse(text); } catch { return text; }
}

async function restQuery(table) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*&limit=0`, {
    headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` },
  });
  return res.status;
}

console.log('\n═══════════════════════════════════════════════════════════');
console.log('  Verificación de migración 011_initial_diagnostic');
console.log('═══════════════════════════════════════════════════════════\n');

const checks = [
  // Columnas nuevas en athletes
  {
    label: 'athletes.discipline (columna nueva)',
    sql: "SELECT column_name FROM information_schema.columns WHERE table_name='athletes' AND column_name='discipline'",
    expect: r => Array.isArray(r) && r.length > 0,
  },
  {
    label: 'athletes.disability_status (columna nueva)',
    sql: "SELECT column_name FROM information_schema.columns WHERE table_name='athletes' AND column_name='disability_status'",
    expect: r => Array.isArray(r) && r.length > 0,
  },
  // Catálogos
  {
    label: 'cat_disciplines (11 registros)',
    sql: 'SELECT COUNT(*)::int AS n FROM public.cat_disciplines',
    expect: r => Array.isArray(r) && r[0]?.n === 11,
  },
  {
    label: 'cat_risk_levels (4 registros)',
    sql: 'SELECT COUNT(*)::int AS n FROM public.cat_risk_levels',
    expect: r => Array.isArray(r) && r[0]?.n === 4,
  },
  // Tablas principales
  {
    label: 'athlete_initial_diagnostic (tabla existe)',
    sql: "SELECT to_regclass('public.athlete_initial_diagnostic')::text AS t",
    expect: r => Array.isArray(r) && r[0]?.t === 'athlete_initial_diagnostic',
  },
  {
    label: 'athlete_diagnostic_sections (tabla existe)',
    sql: "SELECT to_regclass('public.athlete_diagnostic_sections')::text AS t",
    expect: r => Array.isArray(r) && r[0]?.t === 'athlete_diagnostic_sections',
  },
  // Tablas de evaluación por rubro
  {
    label: 'athlete_medical_evaluation (tabla existe)',
    sql: "SELECT to_regclass('public.athlete_medical_evaluation')::text AS t",
    expect: r => Array.isArray(r) && r[0]?.t === 'athlete_medical_evaluation',
  },
  {
    label: 'athlete_nutrition_evaluation (tabla existe)',
    sql: "SELECT to_regclass('public.athlete_nutrition_evaluation')::text AS t",
    expect: r => Array.isArray(r) && r[0]?.t === 'athlete_nutrition_evaluation',
  },
  {
    label: 'athlete_psychology_evaluation (tabla existe)',
    sql: "SELECT to_regclass('public.athlete_psychology_evaluation')::text AS t",
    expect: r => Array.isArray(r) && r[0]?.t === 'athlete_psychology_evaluation',
  },
  {
    label: 'athlete_coach_evaluation (tabla existe)',
    sql: "SELECT to_regclass('public.athlete_coach_evaluation')::text AS t",
    expect: r => Array.isArray(r) && r[0]?.t === 'athlete_coach_evaluation',
  },
  {
    label: 'athlete_physiotherapy_evaluation (tabla existe)',
    sql: "SELECT to_regclass('public.athlete_physiotherapy_evaluation')::text AS t",
    expect: r => Array.isArray(r) && r[0]?.t === 'athlete_physiotherapy_evaluation',
  },
  // Resultados y bitácora
  {
    label: 'athlete_integrated_results (tabla existe)',
    sql: "SELECT to_regclass('public.athlete_integrated_results')::text AS t",
    expect: r => Array.isArray(r) && r[0]?.t === 'athlete_integrated_results',
  },
  {
    label: 'athlete_individual_plans (tabla existe)',
    sql: "SELECT to_regclass('public.athlete_individual_plans')::text AS t",
    expect: r => Array.isArray(r) && r[0]?.t === 'athlete_individual_plans',
  },
  {
    label: 'athlete_follow_up_log (tabla existe)',
    sql: "SELECT to_regclass('public.athlete_follow_up_log')::text AS t",
    expect: r => Array.isArray(r) && r[0]?.t === 'athlete_follow_up_log',
  },
  // RLS habilitado
  {
    label: 'RLS habilitado en athlete_initial_diagnostic',
    sql: "SELECT rowsecurity FROM pg_tables WHERE tablename='athlete_initial_diagnostic'",
    expect: r => Array.isArray(r) && r[0]?.rowsecurity === true,
  },
];

let passed = 0;
let failed = 0;

for (const check of checks) {
  try {
    const result = await query(check.sql);
    const ok = check.expect(result);
    if (ok) {
      console.log(`  ✅  ${check.label}`);
      passed++;
    } else {
      console.log(`  ❌  ${check.label}`);
      console.log(`      Resultado: ${JSON.stringify(result).slice(0, 100)}`);
      failed++;
    }
  } catch (e) {
    console.log(`  ❌  ${check.label} (ERROR: ${e.message})`);
    failed++;
  }
}

console.log(`\n═══════════════════════════════════════════════════════════`);
console.log(`  Resultado: ${passed} ✅  ${failed} ❌   (${passed + failed} verificaciones)`);
console.log(`═══════════════════════════════════════════════════════════`);

if (failed === 0) {
  console.log('\n  🎉 Migración aplicada y verificada correctamente.\n');
  console.log('  Los módulos de Diagnóstico Inicial ya están activos:\n');
  console.log('    • Columnas discipline + disability_status en athletes');
  console.log('    • 11 disciplinas deportivas en cat_disciplines');
  console.log('    • 4 niveles de riesgo en cat_risk_levels');
  console.log('    • 9 tablas nuevas para el diagnóstico integral\n');
  process.exit(0);
} else {
  console.log('\n  ⚠️  Algunas verificaciones fallaron. Revisa la migración.\n');
  process.exit(1);
}
