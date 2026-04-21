import BackButton from '@/components/back-button';
import { getTranslations } from 'next-intl/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requireAdminAccess } from '@/lib/rbac/server';
import NewDisciplineForm from './new-discipline-form';
import DeleteDisciplineButton from './delete-discipline-button';

export const dynamic = 'force-dynamic';

type Sport = {
  id: string;
  name: string;
  category_type: string;
  status: string;
};

const CATEGORY_LABELS: Record<string, string> = {
  individual: 'Individual',
  team:       'Equipo',
};

const STATUS_BADGE: Record<string, string> = {
  active:   'bg-green-100 text-green-700',
  inactive: 'bg-gray-100 text-gray-500',
};

export default async function DisciplinesPage() {
  await requireAdminAccess();

  const t  = await getTranslations('admin.disciplines');
  const tc = await getTranslations('common');

  const { data, error } = await supabaseAdmin
    .from('sports')
    .select('id, name, category_type, status')
    .order('name', { ascending: true });

  const sports = (data ?? []) as Sport[];
  const active   = sports.filter((s) => s.status === 'active');
  const inactive = sports.filter((s) => s.status !== 'active');

  return (
    <main className="p-8 max-w-4xl">
      <BackButton href="/admin" label={tc('backToAdmin')} />

      <div className="mt-4 mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-indigo-700">{t('title')}</h1>
          <p className="text-gray-500 mt-1">{t('description')}</p>
        </div>
      </div>

      {/* Create form */}
      <div className="mb-8">
        <NewDisciplineForm />
      </div>

      {error && (
        <div className="mb-4 rounded border border-red-300 bg-red-50 p-4 text-red-700">
          {t('errorLoading')} {error.message}
        </div>
      )}

      {/* Active disciplines */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-lg font-semibold text-gray-800">{t('activeSectionTitle')}</h2>
          <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
            {active.length}
          </span>
        </div>

        {active.length === 0 ? (
          <p className="text-sm text-gray-400">{t('noActiveDisciplines')}</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {active.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">{s.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {CATEGORY_LABELS[s.category_type] ?? s.category_type}
                    {' · '}
                    <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ${STATUS_BADGE[s.status] ?? 'bg-gray-100 text-gray-500'}`}>
                      {s.status === 'active' ? t('activeStatus') : t('inactiveStatus')}
                    </span>
                  </p>
                </div>
                <DeleteDisciplineButton id={s.id} name={s.name} />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Inactive disciplines */}
      {inactive.length > 0 && (
        <section className="mt-8">
          <div className="flex items-center gap-2 mb-4">
          <h2 className="text-lg font-semibold text-gray-800">{t('inactiveSectionTitle')}</h2>
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
              {inactive.length}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {inactive.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-500 truncate">{s.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {CATEGORY_LABELS[s.category_type] ?? s.category_type}
                  </p>
                </div>
                <DeleteDisciplineButton id={s.id} name={s.name} />
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
