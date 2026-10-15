import { redirect } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { requireAuthenticated } from '@/lib/rbac/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { PsychQuestionnaire } from '@/components/psych/PsychQuestionnaire';
import { ATHLETE_ITEM_COLUMNS, type AthleteQuestionnaireItem } from '@/lib/psych/questionnaire';
import { psychDateLocale, psychLabel } from '@/lib/psych/labels';
import { getAthletePublishedResults } from '@/lib/psych/athlete-results';
import { TZ } from '@/lib/timezone';

export const dynamic = 'force-dynamic';

type Instrument = {
  id: string;
  code: string;
  name: string;
  item_count: number;
  is_active: boolean;
  is_test_only: boolean;
  license_status: 'pending_review' | 'licensed' | 'not_required' | 'denied';
};

type AnsweredAssessmentRow = {
  id: string;
  completed_at: string | null;
  psych_instruments: { name: string } | { name: string }[] | null;
};

export default async function AthletePsychDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ submitted?: string }>;
}) {
  const user = await requireAuthenticated();
  if (!user.profile || !user.roles.some((role) => role.code === 'athlete')) {
    redirect('/dashboard');
  }

  const [t, tc, locale, { submitted }] = await Promise.all([
    getTranslations('psych.athlete'),
    getTranslations('psych.common'),
    getLocale(),
    searchParams,
  ]);
  const results = await getAthletePublishedResults(user.profile.id);
  // Only what the athlete needs for their own record: test and date answered.
  const { data: answeredRows } = await supabaseAdmin
    .from('psych_assessments')
    .select('id, completed_at, psych_instruments!inner(name, is_test_only)')
    .eq('athlete_id', user.profile.id)
    .in('status', ['completed', 'under_review', 'approved'])
    .eq('psych_instruments.is_test_only', false)
    .order('completed_at', { ascending: false });
  const answered = ((answeredRows ?? []) as AnsweredAssessmentRow[]).map((row) => {
    const instrument = Array.isArray(row.psych_instruments) ? row.psych_instruments[0] : row.psych_instruments;
    return { id: row.id, instrumentName: instrument?.name ?? tc('instrumentFallback'), completedAt: row.completed_at };
  });
  const formatDate = (value: string) => new Date(value).toLocaleDateString(psychDateLocale(locale), {
    timeZone: TZ,
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const { data: assessmentRaw } = await supabaseAdmin
    .from('psych_assessments')
    .select('id, scheduled_for, psych_instruments!inner(id, code, name, item_count, is_active, is_test_only, license_status)')
    .eq('athlete_id', user.profile.id)
    .eq('status', 'pending')
    .or(`scheduled_for.is.null,scheduled_for.lte.${new Date().toISOString()}`)
    .eq('psych_instruments.is_active', true)
    .eq('psych_instruments.is_test_only', false)
    .in('psych_instruments.license_status', ['licensed', 'not_required'])
    .order('scheduled_for', { ascending: true })
    .limit(1)
    .maybeSingle();

  const assessment = assessmentRaw as {
    id: string;
    scheduled_for: string | null;
    psych_instruments: Instrument | Instrument[] | null;
  } | null;
  const instrument = Array.isArray(assessment?.psych_instruments)
    ? assessment?.psych_instruments[0]
    : assessment?.psych_instruments;

  const { data: itemRows } = instrument
    ? await supabaseAdmin
      .from('psych_instrument_items')
      .select(ATHLETE_ITEM_COLUMNS)
      .eq('instrument_id', instrument.id)
      .order('item_order')
    : { data: [] as AthleteQuestionnaireItem[] };
  const items = (itemRows ?? []) as AthleteQuestionnaireItem[];
  const hasAvailableQuestionnaire = Boolean(
    assessment &&
    instrument &&
    items.length === instrument.item_count
  );


  return (
    <main className="max-w-6xl p-8">
      <header className="mb-8 border-l-4 border-[#C0172C] pl-4">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#C0172C]">{t('eyebrow')}</p>
        <h1 className="mt-1 text-3xl font-bold text-[#2D2D2D]">{t('title')}</h1>
        <p className="mt-2 max-w-2xl text-sm text-gray-600">
          {t('description')}
        </p>
      </header>

      {submitted === '1' && (
        <p className="mb-6 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800" role="status">{t('submitted')}</p>
      )}

      <section className="mb-10">
        {hasAvailableQuestionnaire && assessment && instrument ? (
          <PsychQuestionnaire assessmentId={assessment.id} instrumentName={instrument.name} items={items} />
        ) : (
          <div className="rounded-2xl border border-dashed border-red-200 bg-red-50 px-6 py-10 text-center">
            <p className="text-lg font-bold text-[#2D2D2D]">{t('emptyTitle')}</p>
            <p className="mx-auto mt-2 max-w-xl text-sm text-gray-600">
              {t('emptyDescription')}
            </p>
          </div>
        )}
      </section>

      <section className="mb-10 rounded-2xl border border-green-200 bg-green-50 p-5">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-green-800">{t('resultsEyebrow')}</p>
        <h2 className="mt-1 text-xl font-bold text-[#2D2D2D]">{t('resultsTitle')}</h2>
        <p className="mt-1 text-sm text-gray-700">{t('resultsDescription')}</p>
        {results.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-green-200 bg-white px-4 py-6 text-center text-sm text-gray-500">{t('resultsEmpty')}</p>
        ) : (
          <div className="mt-4 space-y-4">
            {results.map((result) => {
              const aboutKey = `instrumentAbout.${result.instrumentCode}`;
              return (
                <article key={result.id} className="rounded-xl border border-green-200 bg-white p-5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h3 className="text-lg font-bold text-[#2D2D2D]">{result.instrumentName}</h3>
                    <div className="text-right text-xs text-gray-500">
                      {result.completedAt && <p>{t('answeredShort', { date: formatDate(result.completedAt) })}</p>}
                      {result.publishedAt && <p>{t('publishedShort', { date: formatDate(result.publishedAt) })}</p>}
                    </div>
                  </div>
                  {tc.has(aboutKey) && (
                    <p className="mt-2 text-sm text-gray-600"><span className="font-semibold text-gray-700">{t('aboutTest')}: </span>{tc(aboutKey)}</p>
                  )}
                  <div className="mt-4">
                    <p className="text-xs font-bold uppercase tracking-wide text-green-800">{t('resultSummary')}</p>
                    <p className="mt-1 whitespace-pre-line text-sm leading-6 text-[#2D2D2D]">{result.summary}</p>
                  </div>
                  {result.interpretations.length > 0 && (
                    <div className="mt-4">
                      <p className="text-xs font-bold uppercase tracking-wide text-green-800">{t('bySubscale')}</p>
                      <dl className="mt-2 grid gap-2 sm:grid-cols-2">
                        {result.interpretations.map((interpretation) => (
                          <div key={interpretation.subscaleCode} className="rounded-lg bg-gray-50 px-3 py-2">
                            <dt className="text-xs font-semibold text-gray-700">{psychLabel(tc, 'subscale', interpretation.subscaleCode)}</dt>
                            <dd className="mt-0.5 whitespace-pre-line text-sm text-gray-700">{interpretation.text}</dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#C0172C]">{t('historyEyebrow')}</p>
        <h2 className="mt-1 text-xl font-bold text-[#2D2D2D]">{t('historyTitle')}</h2>
        <p className="mt-1 text-sm text-gray-600">{t('historyDescription')}</p>
        {answered.length === 0 ? (
          <p className="mt-4 text-sm text-gray-500">{t('historyEmpty')}</p>
        ) : (
          <ul className="mt-4 divide-y divide-gray-100 rounded-xl border border-gray-200">
            {answered.map((assessment) => (
              <li key={assessment.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <p className="font-semibold text-[#2D2D2D]">{assessment.instrumentName}</p>
                <p className="text-sm text-gray-600">
                  {assessment.completedAt ? t('answeredOn', { date: formatDate(assessment.completedAt) }) : tc('noDate')}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
