import Link from 'next/link';
import BackButton from '@/components/back-button';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getTranslations } from 'next-intl/server';
import { getProfilesByRoleCodes } from '@/lib/rbac/server';
import NewStaffForm from '../staff/new-staff-form';
import StaffCard from '../staff/staff-card';
import type { Profile } from '../staff/staff-card';

export const dynamic = 'force-dynamic';

export default async function AdminAthletesPage() {
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

  const t = await getTranslations('admin');
  const tc = await getTranslations('common');

  return (
    <main className="p-8">
      <BackButton href="/admin" label={tc('backToAdmin')} />

      <h1 className="text-3xl font-bold mt-4 mb-2 text-rose-700">{t('athletesSetup.title')}</h1>
      <p className="text-gray-600 mb-8">{t('athletesSetup.description')}</p>

      {error && (
        <div className="mb-6 rounded border border-red-300 bg-red-50 p-4 text-red-700">
          {t('athletesSetup.errorLoading')} {error.message}
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <p className="text-sm text-gray-500">{t('athletesSetup.count', { count: athletes.length })}</p>
        <NewStaffForm
          hasExtendedColumns={hasExtendedColumns}
          presetRole="athlete"
          buttonLabel={t('athletesSetup.addAthlete')}
        />
      </div>

      {athletes.length === 0 ? (
        <p className="text-sm text-gray-500">{t('athletesSetup.noAthletes')}</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {athletes.map((p) => (
            <StaffCard key={p.id} profile={p} hasExtendedColumns={hasExtendedColumns} />
          ))}
        </div>
      )}
    </main>
  );
}
