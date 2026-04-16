import Link from 'next/link';
import BackButton from '@/components/back-button';
import { requireAuthenticated } from '@/lib/rbac/server';
import { getTranslations } from 'next-intl/server';
import type { PlanType } from '@/lib/plans/actions';

export const dynamic = 'force-dynamic';

type DisciplineCard = {
  href:  `/plans/${PlanType}`;
  key:   PlanType;
  card:  string;
  title: string;
  text:  string;
  icon:  string;
};

const disciplines: DisciplineCard[] = [
  {
    href:  '/plans/medical',
    key:   'medical',
    card:  'border-rose-200   bg-rose-50   hover:bg-rose-100',
    title: 'text-rose-800',
    text:  'text-rose-600',
    icon:  '🩺',
  },
  {
    href:  '/plans/nutrition',
    key:   'nutrition',
    card:  'border-emerald-200 bg-emerald-50 hover:bg-emerald-100',
    title: 'text-emerald-800',
    text:  'text-emerald-600',
    icon:  '🥗',
  },
  {
    href:  '/plans/psychology',
    key:   'psychology',
    card:  'border-purple-200 bg-purple-50 hover:bg-purple-100',
    title: 'text-purple-800',
    text:  'text-purple-600',
    icon:  '🧠',
  },
  {
    href:  '/plans/training',
    key:   'training',
    card:  'border-blue-200   bg-blue-50   hover:bg-blue-100',
    title: 'text-blue-800',
    text:  'text-blue-600',
    icon:  '🏋️',
  },
  {
    href:  '/plans/rehabilitation',
    key:   'rehabilitation',
    card:  'border-orange-200 bg-orange-50 hover:bg-orange-100',
    title: 'text-orange-800',
    text:  'text-orange-600',
    icon:  '🦾',
  },
];

export default async function PlansPage() {
  await requireAuthenticated();
  const t  = await getTranslations('plans');
  const tc = await getTranslations('common');

  return (
    <main className="p-8">
      <BackButton href="/dashboard" label={tc('backToDashboard')} />

      <h1 className="text-3xl font-bold mt-4 mb-2 text-indigo-700">{t('title')}</h1>
      <p className="text-gray-500 mb-8">{t('description')}</p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {disciplines.map((d) => (
          <Link
            key={d.key}
            href={d.href}
            className={`rounded-xl border p-6 transition-colors flex items-start gap-4 ${d.card}`}
          >
            <span className="text-3xl mt-0.5">{d.icon}</span>
            <div>
              <h2 className={`text-lg font-bold mb-1 ${d.title}`}>
                {t(`${d.key}.label` as Parameters<typeof t>[0])}
              </h2>
              <p className={`text-sm ${d.text}`}>
                {t(`${d.key}.description` as Parameters<typeof t>[0])}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
