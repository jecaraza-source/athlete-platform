import { redirect } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { requireAuthenticated } from '@/lib/rbac/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

const SEVERITIES = ['high', 'medium', 'low'] as const;

export default async function PsychologicalAlertOverviewPage() {
  const user = await requireAuthenticated();
  if (
    !user.roles.some((role) => ['program_director', 'super_admin'].includes(role.code)) ||
    !user.permissions.has('psych.read_interpreted')
  ) {
    redirect('/dashboard');
  }

  const [t, tc, locale] = await Promise.all([getTranslations('psych.overview'), getTranslations('psych.common'), getLocale()]);
  const { data: alertRows } = await supabaseAdmin
    .from('psych_alerts')
    .select('athlete_id, severity, psych_assessments!inner(psych_instruments!inner(is_test_only))')
    .eq('status', 'open')
    .eq('psych_assessments.psych_instruments.is_test_only', false);
  const alerts = (alertRows ?? []) as Array<{ athlete_id: string; severity: (typeof SEVERITIES)[number] }>;
  const athleteProfileIds = [...new Set(alerts.map((alert) => alert.athlete_id))];

  const { data: athleteRows } = athleteProfileIds.length > 0
    ? await supabaseAdmin
      .from('athletes')
      .select('profile_id, discipline')
      .in('profile_id', athleteProfileIds)
    : { data: [] };
  const disciplineByProfile = new Map(
    (athleteRows ?? []).map((athlete: { profile_id: string | null; discipline: string | null }) => [
      athlete.profile_id,
      athlete.discipline ?? t('noDiscipline'),
    ])
  );

  const severityCounts = Object.fromEntries(
    SEVERITIES.map((severity) => [severity, alerts.filter((alert) => alert.severity === severity).length])
  ) as Record<(typeof SEVERITIES)[number], number>;
  const byDiscipline = new Map<string, number>();
  for (const alert of alerts) {
    const discipline = disciplineByProfile.get(alert.athlete_id) ?? t('noDiscipline');
    byDiscipline.set(discipline, (byDiscipline.get(discipline) ?? 0) + 1);
  }

  return (
    <main className="max-w-6xl p-8">
      <header className="mb-8 border-l-4 border-[#C0172C] pl-4">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#C0172C]">{t('eyebrow')}</p>
        <h1 className="mt-1 text-3xl font-bold text-[#2D2D2D]">{t('title')}</h1>
        <p className="mt-2 max-w-3xl text-sm text-gray-600">
          {t('description')}
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        {SEVERITIES.map((severity) => (
          <article key={severity} className={`rounded-2xl border p-5 ${
            severity === 'high' ? 'border-red-200 bg-red-50' :
            severity === 'medium' ? 'border-amber-200 bg-amber-50' :
            'border-sky-200 bg-sky-50'
          }`}>
            <p className="text-xs font-bold uppercase tracking-wide text-gray-600">{tc(`severity.${severity}`)}</p>
            <p className="mt-2 text-4xl font-bold text-[#2D2D2D]">{severityCounts[severity]}</p>
            <p className="mt-1 text-sm text-gray-600">{t('openAlerts')}</p>
          </article>
        ))}
      </section>

      <section className="mt-8 rounded-2xl border border-gray-200 bg-white shadow-sm">
        <header className="border-b border-gray-100 px-6 py-5">
          <h2 className="text-xl font-bold text-[#2D2D2D]">{t('byDiscipline')}</h2>
        </header>
        <div className="divide-y divide-gray-100">
          {byDiscipline.size === 0 ? (
            <p className="px-6 py-8 text-sm text-gray-500">{t('noOpenAlerts')}</p>
          ) : [...byDiscipline.entries()].sort(([left], [right]) => left.localeCompare(right, locale)).map(([discipline, count]) => (
            <div key={discipline} className="flex items-center justify-between px-6 py-4">
              <p className="font-medium text-[#2D2D2D]">{discipline}</p>
              <span className="rounded-full bg-red-50 px-3 py-1 text-sm font-bold text-[#C0172C]">{count}</span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
