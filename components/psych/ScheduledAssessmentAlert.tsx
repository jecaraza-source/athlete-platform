import { getLocale, getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { TZ } from '@/lib/timezone';
import { psychDateLocale } from '@/lib/psych/labels';
import { PSYCH_COMPLETION_WINDOW_DAYS } from '@/lib/psych/deadline';
import { getAthletePendingAssessments } from '@/lib/psych/athlete-overview';

/**
 * Athlete dashboard notice for scheduled psychological tests: instrument,
 * generation date and the completion window. Renders nothing when the
 * athlete has no pending test.
 */
export async function ScheduledAssessmentAlert({ profileId }: { profileId: string }) {
  if (!profileId) return null;

  const rows = await getAthletePendingAssessments(profileId);
  if (rows.length === 0) return null;

  const [t, locale] = await Promise.all([getTranslations('psych.dashboardAlert'), getLocale()]);
  const formatDate = (date: Date) => date.toLocaleDateString(psychDateLocale(locale), {
    timeZone: TZ,
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <section className="mb-8 rounded-2xl border border-amber-200 bg-amber-50 p-5" aria-live="polite">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-800">{t('eyebrow')}</p>
      <h2 className="mt-1 text-lg font-bold text-gray-900">{t('title', { count: rows.length })}</h2>
      <p className="mt-1 text-sm text-amber-900">{t('window', { days: PSYCH_COMPLETION_WINDOW_DAYS })}</p>
      <ul className="mt-4 space-y-3">
        {rows.map((row) => {
          return (
            <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-white px-4 py-3">
              <div>
                <p className="font-semibold text-gray-900">{row.instrumentName}</p>
                <p className="mt-0.5 text-xs text-gray-500">{t('generatedOn', { date: formatDate(new Date(row.createdAt)) })}</p>
                {row.isOverdue ? (
                  <p className="mt-1 text-sm font-semibold text-red-700">
                    {t('overdue', { days: PSYCH_COMPLETION_WINDOW_DAYS, date: formatDate(new Date(row.dueAt)) })}
                  </p>
                ) : (
                  <p className="mt-1 text-sm text-gray-700">
                    {row.isOpen
                      ? t('dueBy', { date: formatDate(new Date(row.dueAt)) })
                      : t('availableFrom', { date: formatDate(new Date(row.opensAt)) })}
                    {' · '}
                    <span className="font-semibold text-amber-800">{t('daysLeft', { count: row.daysLeft })}</span>
                  </p>
                )}
              </div>
              {row.isOpen && (
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
