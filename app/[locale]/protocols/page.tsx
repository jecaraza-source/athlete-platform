import Link from 'next/link';
import BackButton from '@/components/back-button';
import { requireAuthenticated } from '@/lib/rbac/server';
import { getTranslations } from 'next-intl/server';

export const dynamic = 'force-dynamic';

type Discipline = {
  href: '/protocols/coach' | '/protocols/physio' | '/protocols/medic' | '/protocols/nutrition' | '/protocols/psychology';
  key: 'coach' | 'physio' | 'medic' | 'nutrition' | 'psychology';
  card: string;
  title: string;
  text: string;
};

const disciplines: Discipline[] = [
  {
    href:  '/protocols/coach',
    key:   'coach',
    card:  'border-blue-200   bg-blue-50   hover:bg-blue-100',
    title: 'text-blue-800',
    text:  'text-blue-600',
  },
  {
    href:  '/protocols/physio',
    key:   'physio',
    card:  'border-orange-200 bg-orange-50 hover:bg-orange-100',
    title: 'text-orange-800',
    text:  'text-orange-600',
  },
  {
    href:  '/protocols/medic',
    key:   'medic',
    card:  'border-rose-200   bg-rose-50   hover:bg-rose-100',
    title: 'text-rose-800',
    text:  'text-rose-600',
  },
  {
    href:  '/protocols/nutrition',
    key:   'nutrition',
    card:  'border-emerald-200 bg-emerald-50 hover:bg-emerald-100',
    title: 'text-emerald-800',
    text:  'text-emerald-600',
  },
  {
    href:  '/protocols/psychology',
    key:   'psychology',
    card:  'border-purple-200 bg-purple-50 hover:bg-purple-100',
    title: 'text-purple-800',
    text:  'text-purple-600',
  },
];

export default async function ProtocolsPage() {
  await requireAuthenticated();
  const t = await getTranslations('protocols');
  const tc = await getTranslations('common');

  return (
    <main className="p-8">
      <BackButton href="/dashboard" label={tc('backToDashboard')} />

      <h1 className="text-3xl font-bold mt-4 mb-2 text-violet-700">{t('title')}</h1>
      <p className="text-gray-500 mb-8">{t('description')}</p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {disciplines.map((d) => (
          <Link
            key={d.href}
            href={d.href}
            className={`rounded-xl border p-6 transition-colors ${d.card}`}
          >
            <h2 className={`text-lg font-bold mb-1.5 ${d.title}`}>{t(`${d.key}.label` as Parameters<typeof t>[0])}</h2>
            <p className={`text-sm ${d.text}`}>{t(`${d.key}.description` as Parameters<typeof t>[0])}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}
