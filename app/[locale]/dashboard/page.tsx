import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

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

  // Fetch KPIs in parallel — all queries are resilient (errors → default value)
  const now      = new Date();
  const weekEnd  = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const [
    { count: totalAthletes },
    { count: activeAthletes },
    { count: openTickets },
    { count: upcomingEvents },
    { count: pendingDiagnostics },
  ] = await Promise.all([
    supabaseAdmin.from('athletes').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('athletes').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    supabaseAdmin.from('tickets').select('*', { count: 'exact', head: true }).eq('status', 'open'),
    supabaseAdmin.from('events').select('*', { count: 'exact', head: true })
      .gte('start_at', now.toISOString()).lte('start_at', weekEnd),
    supabaseAdmin.from('athlete_initial_diagnostic').select('*', { count: 'exact', head: true })
      .neq('overall_status', 'completo'),
  ]);

  const metrics = [
    {
      label:  t('metricsActiveAthletes'),
      value:  activeAthletes ?? 0,
      sub:    t('metricsTotal', { total: totalAthletes ?? 0 }),
      href:   '/athletes' as const,
      color:  'text-emerald-700',
      border: 'border-emerald-200 bg-emerald-50',
    },
    {
      label:  t('metricsOpenTickets'),
      value:  openTickets ?? 0,
      sub:    null,
      href:   '/admin/tickets' as const,
      color:  openTickets ? 'text-rose-600' : 'text-gray-500',
      border: openTickets ? 'border-rose-200 bg-rose-50' : 'border-gray-200 bg-gray-50',
    },
    {
      label:  t('metricsUpcomingEvents'),
      value:  upcomingEvents ?? 0,
      sub:    null,
      href:   '/calendar' as const,
      color:  'text-sky-700',
      border: 'border-sky-200 bg-sky-50',
    },
    {
      label:  t('metricsPendingDiagnostics'),
      value:  pendingDiagnostics ?? 0,
      sub:    null,
      href:   '/athletes' as const,
      color:  pendingDiagnostics ? 'text-amber-700' : 'text-gray-500',
      border: pendingDiagnostics ? 'border-amber-200 bg-amber-50' : 'border-gray-200 bg-gray-50',
    },
  ] as const;

  return (
    <main className="p-8">
      <h1 className="text-3xl font-bold text-indigo-700">{t('title')}</h1>
      <p className="mt-2 text-gray-500 mb-6">{t('welcome')}</p>

      {/* KPI metrics row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {metrics.map((m) => (
          <Link
            key={m.label}
            href={m.href}
            className={`rounded-xl border p-5 transition-colors hover:opacity-90 ${m.border}`}
          >
            <p className={`text-3xl font-extrabold ${m.color}`}>{m.value}</p>
            <p className="text-sm font-medium text-gray-700 mt-1">{m.label}</p>
            {m.sub && <p className="text-xs text-gray-400 mt-0.5">{m.sub}</p>}
          </Link>
        ))}
      </div>

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
