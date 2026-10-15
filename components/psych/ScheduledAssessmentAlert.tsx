import { getLocale, getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { TZ } from '@/lib/timezone';
import { psychDateLocale } from '@/lib/psych/labels';
import { assessmentDeadline, PSYCH_COMPLETION_WINDOW_DAYS } from '@/lib/psych/deadline';

type PendingAssessmentRow = {
  id: string;
  created_at: string;
  scheduled_for: string | null;
  psych_instruments: { name: string } | { name: string }[] | null;
};

/**
 * Athlete dashboard notice for scheduled psychological tests: instrument,
 * generation date and the completion window. Renders nothing when the
 * athlete has no pending test.
 */
export async function ScheduledAssessmentAlert({ profileId }: { profileId: string }) {
  if (!profileId) return null;

  const { data } = await supabaseAdmin
    .from('psych_assessments')
    .select('id, created_at, scheduled_for, psych_instruments!inner(name, is_active, is_test_only, license_status)')
    .eq('athlete_id', profileId)
    .eq('status', 'pending')
    .eq('psych_instruments.is_active', true)
    .eq('psych_instruments.is_test_only', false)
    .in('psych_instruments.license_status', ['licensed', 'not_required'])
    .order('created_at', { ascending: true });
  const rows = (data ?? []) as PendingAssessmentRow[];
  if (rows.length === 0) return null;

  const [t, tc, locale] = await Promise.all([
    getTranslations('psych.dashboardAlert'),
    getTranslations('psych.common'),
    getLocale(),
  ]);
  const formatDate = (date: Date) => date.toLocaleDateString(psychDateLocale(locale), {
    timeZone: TZ,
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const now = new Date();

  return (
    <section className="mb-8 rounded-2xl border border-amber-200 bg-amber-50 p-5" aria-live="polite">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-800">{t('eyebrow')}</p>
      <h2 className="mt-1 text-lg font-bold text-gray-900">{t('title', { count: rows.length })}</h2>
      <p className="mt-1 text-sm text-amber-900">{t('window', { days: PSYCH_COMPLETION_WINDOW_DAYS })}</p>
      <ul className="mt-4 space-y-3">
        {rows.map((row) => {
          const instrument = Array.isArray(row.psych_instruments) ? row.psych_instruments[0] : row.psych_instruments;
          const deadline = assessmentDeadline(row.created_at, row.scheduled_for, now);
          return (
            <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-white px-4 py-3">
              <div>
                <p className="font-semibold text-gray-900">{instrument?.name ?? tc('instrumentFallback')}</p>
                <p className="mt-0.5 text-xs text-gray-500">{t('generatedOn', { date: formatDate(new Date(row.created_at)) })}</p>
                {deadline.isOverdue ? (
                  <p className="mt-1 text-sm font-semibold text-red-700">
                    {t('overdue', { days: PSYCH_COMPLETION_WINDOW_DAYS, date: formatDate(deadline.dueAt) })}
                  </p>
                ) : (
                  <p className="mt-1 text-sm text-gray-700">
                    {deadline.isOpen
                      ? t('dueBy', { date: formatDate(deadline.dueAt) })
                      : t('availableFrom', { date: formatDate(deadline.opensAt) })}
                    {' · '}
                    <span className="font-semibold text-amber-800">{t('daysLeft', { count: deadline.daysLeft })}</span>
                  </p>
                )}
              </div>
              {deadline.isOpen && (
                <Link
                  href="/dashboard/psych"
                  className="rounded-lg bg-[#C0172C] px-4 py-2 text-sm font-semibold text-white hover:bg-[#C1000E]"
                >
                  {t('start')}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
