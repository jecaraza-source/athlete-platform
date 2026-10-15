'use client';

import { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { psychDateLocale } from '@/lib/psych/labels';
import { ASSESSMENT_STAGE_ORDER, assessmentStage, type AssessmentStage } from '@/lib/psych/stage';

type Assessment = {
  id: string;
  athleteName: string;
  instrumentName: string;
  completedAt: string | null;
  status: 'under_review' | 'approved';
  published: boolean;
};

const STAGE_STYLES: Record<AssessmentStage, string> = {
  pending: 'bg-amber-50 text-amber-800',
  approved: 'bg-sky-50 text-sky-800',
  published: 'bg-green-50 text-green-800',
};

export function PsychAssessmentList({ assessments }: { assessments: Assessment[] }) {
  const t = useTranslations('psych.clinical.list');
  const locale = useLocale();
  const [athleteFilter, setAthleteFilter] = useState('');
  const [instrumentFilter, setInstrumentFilter] = useState('');
  const [stageFilter, setStageFilter] = useState<'all' | AssessmentStage>('all');
  const pendingCount = assessments.filter((assessment) => assessmentStage(assessment) === 'pending').length;
  // Pending grading first; within a stage keep the newest completion on top.
  const filtered = useMemo(() => assessments
    .filter((assessment) =>
      assessment.athleteName.toLowerCase().includes(athleteFilter.toLowerCase()) &&
      assessment.instrumentName.toLowerCase().includes(instrumentFilter.toLowerCase()) &&
      (stageFilter === 'all' || assessmentStage(assessment) === stageFilter)
    )
    .sort((left, right) =>
      ASSESSMENT_STAGE_ORDER[assessmentStage(left)] - ASSESSMENT_STAGE_ORDER[assessmentStage(right)] ||
      (right.completedAt ?? '').localeCompare(left.completedAt ?? '')
    ), [assessments, athleteFilter, instrumentFilter, stageFilter]);
  const stageLabel: Record<AssessmentStage, string> = {
    pending: t('pendingBadge'),
    approved: t('approvedBadge'),
    published: t('publishedBadge'),
  };

  return (
    <section className="mt-10 rounded-2xl border border-amber-200 bg-amber-50 p-5">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-800">{t('eyebrow')}</p><h2 className="mt-1 text-2xl font-bold text-[#2D2D2D]">{t('title')}</h2></div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${pendingCount > 0 ? 'bg-amber-200 text-amber-900' : 'bg-white text-gray-600'}`}>{t('pendingCount', { count: pendingCount })}</span>
      </div>
      <div className="mb-4 grid gap-2 md:grid-cols-3">
        <input value={athleteFilter} onChange={(event) => setAthleteFilter(event.target.value)} placeholder={t('filterAthlete')} className="rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm" />
        <input value={instrumentFilter} onChange={(event) => setInstrumentFilter(event.target.value)} placeholder={t('filterInstrument')} className="rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm" />
        <select value={stageFilter} onChange={(event) => setStageFilter(event.target.value as 'all' | AssessmentStage)} className="rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm"><option value="all">{t('allStatuses')}</option><option value="pending">{t('pendingGrading')}</option><option value="approved">{t('approvedUnpublished')}</option><option value="published">{t('published')}</option></select>
      </div>
      <div className="overflow-hidden rounded-xl border border-amber-200 bg-white">
        {filtered.length === 0 ? <p className="px-6 py-8 text-sm text-gray-500">{t('empty')}</p> : filtered.map((assessment) => {
          const stage = assessmentStage(assessment);
          return (
            <div key={assessment.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-4 last:border-0">
              <div><p className="font-semibold text-[#2D2D2D]">{assessment.athleteName}</p><p className="text-sm text-gray-600">{assessment.instrumentName}</p></div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="text-right">
                  {assessment.completedAt && <p className="text-xs text-gray-500">{t('completedOn', { date: new Date(assessment.completedAt).toLocaleDateString(psychDateLocale(locale)) })}</p>}
                  <span className={`mt-1 inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${STAGE_STYLES[stage]}`}>{stageLabel[stage]}</span>
                </div>
                <Link
                  href={`/dashboard/mental-health/assessments/${assessment.id}`}
                  className={stage === 'pending'
                    ? 'rounded-lg bg-[#C0172C] px-4 py-2 text-sm font-semibold text-white hover:bg-[#C1000E]'
                    : 'rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50'}
                >
                  {stage === 'pending' ? t('grade') : t('view')}
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
