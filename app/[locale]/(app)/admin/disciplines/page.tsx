import BackButton from '@/components/back-button';
import { getTranslations } from 'next-intl/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requireAdminAccess } from '@/lib/rbac/server';
import NewDisciplineForm from './new-discipline-form';
import DeleteDisciplineButton from './delete-discipline-button';

export const dynamic = 'force-dynamic';

type Discipline = {
  id: number;
  code: string;
  name: string;
  block: string;
};

const BLOCK_LABELS: Record<string, string> = {
  combate:     'Combate',
  resistencia: 'Resistencia',
  precision:   'Precisión',
  acrobatico:  'Acrobático',
};

export default async function DisciplinesPage() {
  await requireAdminAccess();

  const t  = await getTranslations('admin.disciplines');
  const tc = await getTranslations('common');

  const { data, error } = await supabaseAdmin
    .from('cat_disciplines')
    .select('id, code, name, block')
    .order('name', { ascending: true });

  const disciplines = (data ?? []) as Discipline[];

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

      <section>
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-lg font-semibold text-gray-800">{t('activeSectionTitle')}</h2>
          <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
            {disciplines.length}
          </span>
        </div>

        {disciplines.length === 0 ? (
          <p className="text-sm text-gray-400">{t('noActiveDisciplines')}</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {disciplines.map((d) => (
              <div
                key={d.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">{d.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    <span className="font-mono">{d.code}</span>
                    {' · '}
                    {BLOCK_LABELS[d.block] ?? d.block}
                  </p>
                </div>
                <DeleteDisciplineButton id={String(d.id)} name={d.name} />
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
