import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';

type Card = {
  href: '/athletes' | '/calendar' | '/follow-up' | '/protocols';
  labelKey: 'athletes' | 'calendar' | 'followUp' | 'protocols';
  descKey: 'athletesDescription' | 'calendarDescription' | 'followUpDescription' | 'protocolsDescription';
  card: string;
  title: string;
  text: string;
};

const cards: Card[] = [
  {
    href:     '/athletes',
    labelKey: 'athletes',
    descKey:  'athletesDescription',
    card:     'border-emerald-200 bg-emerald-50 hover:bg-emerald-100',
    title:    'text-emerald-800',
    text:     'text-emerald-600',
  },
  {
    href:     '/calendar',
    labelKey: 'calendar',
    descKey:  'calendarDescription',
    card:     'border-sky-200    bg-sky-50    hover:bg-sky-100',
    title:    'text-sky-800',
    text:     'text-sky-600',
  },
  {
    href:     '/follow-up',
    labelKey: 'followUp',
    descKey:  'followUpDescription',
    card:     'border-amber-200  bg-amber-50  hover:bg-amber-100',
    title:    'text-amber-800',
    text:     'text-amber-600',
  },
  {
    href:     '/protocols',
    labelKey: 'protocols',
    descKey:  'protocolsDescription',
    card:     'border-violet-200 bg-violet-50 hover:bg-violet-100',
    title:    'text-violet-800',
    text:     'text-violet-600',
  },
];

export default async function DashboardPage() {
  const t = await getTranslations('dashboard');
  return (
    <main className="p-8">
      <h1 className="text-3xl font-bold text-indigo-700">{t('title')}</h1>
      <p className="mt-2 text-gray-500 mb-8">{t('welcome')}</p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className={`rounded-xl border p-6 transition-colors ${c.card}`}
          >
            <h2 className={`font-bold text-lg mb-1 ${c.title}`}>{t(c.labelKey)}</h2>
            <p className={`text-sm ${c.text}`}>{t(c.descKey)}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}
