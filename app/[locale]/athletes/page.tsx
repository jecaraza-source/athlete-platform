import { Link } from '@/i18n/navigation';
import BackButton from '@/components/back-button';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requirePermission } from '@/lib/rbac/server';
import { getTranslations } from 'next-intl/server';
import { getDisciplineLabel, STATUS_LABELS, STATUS_DOT } from '@/lib/types/diagnostic';
import type { DiagnosticStatus } from '@/lib/types/diagnostic';
import AthletesFilter from './athletes-filter';
import Pagination from '@/components/pagination';

const PER_PAGE = 20;

export const dynamic = 'force-dynamic';

type Athlete = {
  id: string;
  first_name: string;
  last_name: string;
  status: string;
  discipline: string | null;
  disability_status: string | null;
  diagnostic_status: DiagnosticStatus | null;
  diagnostic_pct: number | null;
};

export default async function AthletesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; discipline?: string; diagnostic?: string; page?: string }>;
}) {
  await requirePermission('view_athletes');
  const t  = await getTranslations('athletes');
  const tc = await getTranslations('common');

  const { q = '', status = '', discipline = '', diagnostic = '', page: pageStr = '1' } = await searchParams;
  const page = Math.max(1, parseInt(pageStr, 10) || 1);

  // ───────────────────────────────────────────────────────────────────────
  // Query resiliente: intenta con campos nuevos (post-migración 011); si
  // fallan (columnas/tablas no existen aún), cae a la query base.
  // ───────────────────────────────────────────────────────────────────────

  // 1. Query base con filtros de nombre y estado (server-side)
  let baseQuery = supabaseAdmin
    .from('athletes')
    .select('id, first_name, last_name, status, school_or_club')
    .order('last_name', { ascending: true });

  if (q) {
    baseQuery = baseQuery.or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%`);
  }
  if (status) {
    baseQuery = baseQuery.eq('status', status);
  }

  const { data: baseData, error: baseError } = await baseQuery;

  if (baseError || !baseData) {
    return (
      <main className="p-8">
        <BackButton href="/dashboard" label={tc('backToDashboard')} />
        <h1 className="text-2xl font-bold mt-4 text-emerald-700">{t('title')}</h1>
        <p className="text-red-600 mt-4">{t('failedToLoad')}</p>
      </main>
    );
  }

  // 2. Enriquecer con campos post-migración (discipline, disability_status)
  //    Si la columna no existe, el error se ignora silenciosamente.
  const { data: extendedData } = await supabaseAdmin
    .from('athletes')
    .select('id, discipline, disability_status')
    .order('last_name', { ascending: true });

  const extMap = Object.fromEntries(
    (extendedData ?? []).map((r: Record<string, unknown>) => [r.id, r])
  );

  // 3. Datos de diagnóstico (requiere migración 011 aplicada)
  const { data: diagData } = await supabaseAdmin
    .from('athlete_initial_diagnostic')
    .select('athlete_id, overall_status, completion_pct');

  const diagMap = Object.fromEntries(
    (diagData ?? []).map((d: Record<string, unknown>) => [d.athlete_id, d])
  );

  let athletes: Athlete[] = baseData.map((a: Record<string, unknown>) => {
    const ext  = extMap[a.id as string] as Record<string, unknown> | undefined;
    const diag = diagMap[a.id as string] as Record<string, unknown> | undefined;
    return {
      id:                a.id as string,
      first_name:        a.first_name as string,
      last_name:         a.last_name as string,
      status:            a.status as string,
      discipline:        (ext?.discipline as string) ?? null,
      disability_status: (ext?.disability_status as string) ?? null,
      diagnostic_status: (diag?.overall_status as DiagnosticStatus) ?? null,
      diagnostic_pct:    (diag?.completion_pct as number) ?? null,
    };
  });

  // Filtros en memoria (discipline y diagnostic no tienen columna directa en base query)
  if (discipline) {
    athletes = athletes.filter((a) => a.discipline === discipline);
  }
  if (diagnostic) {
    athletes = athletes.filter(
      (a) => (a.diagnostic_status ?? 'pendiente') === diagnostic
    );
  }

  const hasActiveFilters = !!(q || status || discipline || diagnostic);

  // Paginate the fully-filtered array
  const totalItems  = athletes.length;
  const totalPages  = Math.ceil(totalItems / PER_PAGE);
  const safePage    = Math.min(page, Math.max(1, totalPages));
  const from        = (safePage - 1) * PER_PAGE;
  const paginated   = athletes.slice(from, from + PER_PAGE);

  return (
    <main className="p-8">
      <BackButton href="/dashboard" label={tc('backToDashboard')} />
      <h1 className="text-2xl font-bold mt-4 mb-4 text-emerald-700">{t('title')}</h1>

      <AthletesFilter
        currentQ={q}
        currentStatus={status}
        currentDiscipline={discipline}
        currentDiagnostic={diagnostic}
      />

      {paginated.length === 0 ? (
        <p className="text-gray-500">
          {hasActiveFilters ? t('noResults') : t('noAthletes')}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <p className="text-xs text-gray-400 mb-3">
            {t('showing', { count: totalItems })}
          </p>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="pb-2 pr-4 font-medium">{t('name')}</th>
                <th className="pb-2 pr-4 font-medium">{t('colDiscipline')}</th>
                <th className="pb-2 pr-4 font-medium">{t('colDiagnostic')}</th>
                <th className="pb-2 font-medium">{t('status')}</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((athlete) => {
                const diagStatus = athlete.diagnostic_status ?? 'pendiente';
                const diagPct    = athlete.diagnostic_pct ?? 0;
                return (
                  <tr key={athlete.id} className="border-b hover:bg-gray-50">
                    <td className="py-3 pr-4">
                      <Link
                        href={`/athletes/${athlete.id}`}
                        className="text-blue-600 hover:underline font-medium"
                      >
                        {athlete.first_name} {athlete.last_name}
                      </Link>
                    </td>
                    <td className="py-3 pr-4 text-gray-600">
                      {getDisciplineLabel(athlete.discipline)}
                    </td>
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${STATUS_DOT[diagStatus as DiagnosticStatus] ?? 'bg-gray-400'}`} />
                        <span className="text-gray-600 text-xs">
                          {STATUS_LABELS[diagStatus as DiagnosticStatus] ?? '—'}
                        </span>
                        {diagPct > 0 && (
                          <span className="text-gray-400 text-xs">({diagPct}%)</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 text-gray-600 capitalize">{athlete.status}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <Pagination page={safePage} totalPages={totalPages} totalItems={totalItems} />
        </div>
      )}
    </main>
  );
}
