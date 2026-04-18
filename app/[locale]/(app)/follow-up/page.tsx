import { Link } from '@/i18n/navigation';
import BackButton from '@/components/back-button';
import { getTranslations } from 'next-intl/server';

type Category = {
  href: '/follow-up/training' | '/follow-up/nutrition' | '/follow-up/physio' | '/follow-up/psychology' | '/follow-up/medical';
  labelKey: 'training' | 'nutrition' | 'physio' | 'psychology' | 'medical';
  card: string;
  title: string;
  text: string;
};

const categories: Category[] = [
  {
    href:     '/follow-up/training',
    labelKey: 'training',
    card:     'border-blue-200   bg-blue-50   hover:bg-blue-100',
    title:    'text-blue-800',
    text:     'text-blue-600',
  },
  {
    href:     '/follow-up/nutrition',
    labelKey: 'nutrition',
    card:     'border-emerald-200 bg-emerald-50 hover:bg-emerald-100',
    title:    'text-emerald-800',
    text:     'text-emerald-600',
  },
  {
    href:     '/follow-up/physio',
    labelKey: 'physio',
    card:     'border-orange-200 bg-orange-50 hover:bg-orange-100',
    title:    'text-orange-800',
    text:     'text-orange-600',
  },
  {
    href:     '/follow-up/psychology',
    labelKey: 'psychology',
    card:     'border-purple-200 bg-purple-50 hover:bg-purple-100',
    title:    'text-purple-800',
    text:     'text-purple-600',
  },
  {
    href:     '/follow-up/medical',
    labelKey: 'medical',
    card:     'border-rose-200   bg-rose-50   hover:bg-rose-100',
    title:    'text-rose-800',
    text:     'text-rose-600',
  },
];

export default async function FollowUpPage() {
  const t = await getTranslations('followUp');
  const tc = await getTranslations('common');
  return (
    <main className="p-8">
      <BackButton href="/dashboard" label={tc('backToDashboard')} />
      <h1 className="text-3xl font-bold mt-4 mb-2 text-amber-700">{t('title')}</h1>
      <p className="text-gray-500 mb-8">{t('description')}</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {categories.map((cat) => (
          <Link
            key={cat.href}
            href={cat.href}
            className={`rounded-xl border p-6 transition-colors ${cat.card}`}
          >
            <h2 className={`font-bold text-lg mb-1 ${cat.title}`}>{t(`${cat.labelKey}.title` as Parameters<typeof t>[0])}</h2>
            <p className={`text-sm ${cat.text}`}>{t(`${cat.labelKey}.description` as Parameters<typeof t>[0])}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}
