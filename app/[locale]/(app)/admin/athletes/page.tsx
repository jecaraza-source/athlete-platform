import BackButton from '@/components/back-button';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getTranslations } from 'next-intl/server';
import { getProfilesByRoleCodes } from '@/lib/rbac/server';
import NewStaffForm from '../staff/new-staff-form';
import StaffCard from '../staff/staff-card';
import type { Profile } from '../staff/staff-card';
import AthletesConfigFilter from './athletes-config-filter';

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
      <BackButton href="/admin" label={tc('backToAdmin')} />

      <h1 className="text-3xl font-bold mt-4 mb-2 text-rose-700">{t('athletesSetup.title')}</h1>
      <p className="text-gray-600 mb-4">{t('athletesSetup.description')}</p>

      {error && (
        <div className="mb-6 rounded border border-red-300 bg-red-50 p-4 text-red-700">
          {t('athletesSetup.errorLoading')} {error.message}
        </div>
      )}

      <AthletesConfigFilter
        currentQ={q}
        currentDiscipline={discipline}
        total={athletes.length}
        filtered={filtered.length}
      />

      <div className="flex items-center justify-end mb-4">
        <NewStaffForm
          hasExtendedColumns={hasExtendedColumns}
          presetRole="athlete"
          buttonLabel={t('athletesSetup.addAthlete')}
        />
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-gray-500">
          {athletes.length === 0 ? t('athletesSetup.noAthletes') : 'No se encontraron atletas con esos filtros.'}
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((p) => (
            <StaffCard key={p.id} profile={p} hasExtendedColumns={hasExtendedColumns} />
          ))}
        </div>
      )}
    </main>
  );
}
