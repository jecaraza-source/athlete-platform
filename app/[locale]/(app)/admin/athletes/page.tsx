import BackButton from '@/components/back-button';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getTranslations } from 'next-intl/server';
import { getProfilesByRoleCodes } from '@/lib/rbac/server';
import NewStaffForm from '../staff/new-staff-form';
import StaffCard from '../staff/staff-card';
import type { Profile } from '../staff/staff-card';
import AthletesConfigFilter from './athletes-config-filter';
import ExportAthletesButton from './export-athletes-button';

export const dynamic = 'force-dynamic';

export default async function AdminAthletesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; discipline?: string }>;
}) {
  const { q = '', discipline = '' } = await searchParams;
  // Primary: RBAC-based query (user_roles → roles.code = 'athlete').
  // Falls back to legacy profiles.role = 'athlete' if no RBAC assignments found.
  const rbacAthletes = await getProfilesByRoleCodes(['athlete']);

  // Enrich with extended columns (email, phone, specialty) when available.
  // Start with an empty typed array; it will be populated by the query below.
  let athletes: Profile[] = [];
  let error: { message: string } | null = null;
  let hasExtendedColumns = true;

  if (rbacAthletes.length > 0) {
    const ids = rbacAthletes.map((p) => p.id);
    const { data: extended, error: extErr } = await supabaseAdmin
      .from('profiles')
      .select('id, first_name, last_name, role, email, phone, specialty')
      .in('id', ids)
      .order('last_name', { ascending: true });

    hasExtendedColumns = !extErr?.message?.includes('does not exist');
    error = extErr ?? null;

    if (!extErr && extended) {
      athletes = extended as Profile[];
    } else {
      // Extended columns unavailable — fall back to stub fields only
      athletes = rbacAthletes as unknown as Profile[];
    }
  }

  // Apply filters in memory
  let filtered = athletes;
  if (q) {
    const lower = q.toLowerCase();
    filtered = filtered.filter(
      (a) =>
        a.first_name.toLowerCase().includes(lower) ||
        a.last_name.toLowerCase().includes(lower) ||
        (a.email ?? '').toLowerCase().includes(lower)
    );
  }
  if (discipline) {
    filtered = filtered.filter((a) => a.specialty === discipline);
  }

  const t = await getTranslations('admin');
  const tc = await getTranslations('common');

  return (
    <main className="p-8">
      <div className="no-print">
        <BackButton href="/admin" label={tc('backToAdmin')} />
        <h1 className="text-3xl font-bold mt-4 mb-2 text-rose-700">{t('athletesSetup.title')}</h1>
        <p className="text-gray-600 mb-4">{t('athletesSetup.description')}</p>
      </div>

      {error && (
        <div className="mb-6 rounded border border-red-300 bg-red-50 p-4 text-red-700 no-print">
          {t('athletesSetup.errorLoading')} {error.message}
        </div>
      )}

      <div className="no-print">
      <AthletesConfigFilter
        currentQ={q}
        currentDiscipline={discipline}
        total={athletes.length}
        filtered={filtered.length}
      />
      </div>

      <div className="flex items-center justify-between mb-4 no-print">
        <NewStaffForm
          hasExtendedColumns={hasExtendedColumns}
          presetRole="athlete"
          buttonLabel={t('athletesSetup.addAthlete')}
        />
        <ExportAthletesButton athletes={filtered} discipline={discipline} />
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-gray-500">
          {athletes.length === 0 ? t('athletesSetup.noAthletes') : 'No se encontraron atletas con esos filtros.'}
        </p>
      ) : (
        <>
          {/* Screen: cards grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 no-print">
            {filtered.map((p) => (
              <StaffCard key={p.id} profile={p} hasExtendedColumns={hasExtendedColumns} />
            ))}
          </div>

          {/* Print-only: clean table */}
          <div className="print-only hidden">
            <h2 className="text-lg font-bold mb-3">
              Lista de Atletas{discipline ? ` — ${discipline}` : ''}
              {q ? ` — Búsqueda: "${q}"` : ''}
              <span className="text-sm font-normal ml-2">({filtered.length} atletas)</span>
            </h2>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b-2 border-gray-800 text-left">
                  <th className="pb-2 pr-4">Nombre</th>
                  <th className="pb-2 pr-4">Email</th>
                  <th className="pb-2 pr-4">Teléfono</th>
                  <th className="pb-2">Disciplina</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} className="border-b border-gray-200">
                    <td className="py-1.5 pr-4 font-medium">{p.first_name} {p.last_name}</td>
                    <td className="py-1.5 pr-4 text-gray-600">{p.email ?? '—'}</td>
                    <td className="py-1.5 pr-4 text-gray-600">{p.phone ?? '—'}</td>
                    <td className="py-1.5 text-gray-600">{p.specialty ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </main>
  );
}
