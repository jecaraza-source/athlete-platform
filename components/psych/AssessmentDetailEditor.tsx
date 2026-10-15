'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { approvePsychAssessment, savePsychClinicalReview, savePsychScoreInterpretation } from '@/app/[locale]/(app)/dashboard/mental-health/actions';
import { psychDateLocale, psychLabel } from '@/lib/psych/labels';
import type { ReadableResponse } from '@/lib/psych/responses';

type Score = {
  id: string;
  subscaleCode: string;
  rawScore: number;
  band: string | null;
  interpretationText: string | null;
};

type Props = {
  assessmentId: string;
  assessmentStatus: string;
  published: boolean;
  clinicalSummary: string;
  athleteSummary: string;
  reviewedAt: string | null;
  approvedAt: string | null;
  canEdit: boolean;
  canPublish: boolean;
  scores: Score[];
  responses: ReadableResponse[];
};

export function AssessmentDetailEditor({
  assessmentId,
  assessmentStatus,
  published,
  clinicalSummary,
  athleteSummary,
  reviewedAt,
  approvedAt,
  canEdit,
  canPublish,
  scores,
  responses,
}: Props) {
  const t = useTranslations('psych.detail');
  const tc = useTranslations('psych.common');
  const dateLocale = psychDateLocale(useLocale());
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPublishing, startPublishing] = useTransition();
  const [isSaving, startSaving] = useTransition();
  const [isApproving, startApproving] = useTransition();

  const steps = [
    { key: 'review', done: responses.length > 0 },
    { key: 'summary', done: Boolean(athleteSummary.trim()) },
    { key: 'approve', done: assessmentStatus === 'approved' },
    { key: 'publish', done: published },
  ] as const;
  const currentStep = steps.findIndex((step) => !step.done);

  function finish(result: { error?: string }, successMessage: string) {
    setError(result.error ?? null);
    setMessage(result.error ? null : successMessage);
    if (!result.error) router.refresh();
  }

  function publish() {
    startPublishing(async () => {
      const response = await fetch(`/api/psych/assessments/${assessmentId}/publish`, { method: 'PATCH' });
      finish(response.ok ? {} : { error: t('publishError') }, t('publishSuccess'));
    });
  }

  function saveInterpretation(scoreId: string, form: HTMLFormElement) {
    const interpretationText = String(new FormData(form).get('interpretation_text') ?? '');
    startSaving(async () => {
      finish(await savePsychScoreInterpretation({ scoreId, interpretationText }), t('interpretationSaved'));
    });
  }

  function saveClinicalReview(form: HTMLFormElement) {
    const data = new FormData(form);
    startSaving(async () => {
      finish(await savePsychClinicalReview({
        assessmentId,
        clinicalSummary: String(data.get('clinical_summary') ?? ''),
        athleteSummary: String(data.get('athlete_summary') ?? ''),
      }), t('summarySaved'));
    });
  }

  function approve() {
    startApproving(async () => {
      finish(await approvePsychAssessment({ assessmentId }), t('approved'));
    });
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#C0172C]">{t('stepsTitle')}</p>
        <ol className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, index) => (
            <li
              key={step.key}
              aria-current={index === currentStep ? 'step' : undefined}
              className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm ${
                step.done
                  ? 'border-green-200 bg-green-50 text-green-800'
                  : index === currentStep
                    ? 'border-[#C0172C] bg-red-50 font-semibold text-[#C0172C]'
                    : 'border-gray-200 text-gray-500'
              }`}
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-xs font-bold ring-1 ring-current">{step.done ? '✓' : index + 1}</span>
              {t(`steps.${step.key}`)}
            </li>
          ))}
        </ol>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
          <header className="border-b border-gray-100 px-6 py-5">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#C0172C]">{t('rawEyebrow')}</p>
            <h2 className="mt-1 text-xl font-bold text-[#2D2D2D]">{t('rawTitle')}</h2>
            <p className="mt-1 text-sm text-gray-600">{t('rawHint')}</p>
            <p className="mt-1 text-xs text-gray-500">{t('responseCount', { count: responses.length })}</p>
          </header>
          <ol className="max-h-[720px] divide-y divide-gray-100 overflow-y-auto">
            {responses.length === 0 ? <li className="px-6 py-8 text-sm text-gray-500">{t('noResponses')}</li> : responses.map((response) => (
              <li key={response.itemCode} className="px-6 py-3">
                <p className="text-sm text-[#2D2D2D]">
                  <span className="mr-2 font-semibold text-[#C0172C]">{response.itemOrder ?? '·'}.</span>
                  {response.prompt ?? response.itemCode}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="rounded-lg bg-red-50 px-2.5 py-1 text-sm font-semibold text-[#C0172C]">
                    {response.answerLabel}{response.answerLabel !== response.rawValue && <span className="ml-1 font-normal text-gray-500">({response.rawValue})</span>}
                  </span>
                  {response.subscaleCode && <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-700">{psychLabel(tc, 'subscale', response.subscaleCode)}</span>}
                  {response.isReverseScored && <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">{t('reverseScored')}</span>}
                  <span className="font-mono text-xs text-gray-400">{response.itemCode}</span>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-6 py-5">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#C0172C]">{t('interpretationEyebrow')}</p>
              <h2 className="mt-1 text-xl font-bold text-[#2D2D2D]">{t('interpretationTitle')}</h2>
            </div>
            {published ? <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-800">{t('published')}</span> : assessmentStatus === 'approved' && canPublish ? (
              <button type="button" onClick={publish} disabled={isPublishing} className="rounded-lg bg-[#C0172C] px-4 py-2 text-sm font-semibold text-white hover:bg-[#C1000E] disabled:opacity-60">
                {isPublishing ? t('publishing') : t('publish')}
              </button>
            ) : (
              <div className="text-right">
                <button type="button" disabled className="rounded-lg bg-gray-200 px-4 py-2 text-sm font-semibold text-gray-500">
                  {t('publish')}
                </button>
                <p className="mt-1 max-w-52 text-xs text-gray-500">{t('publishHint')}</p>
              </div>
            )}
          </header>
          <div className="space-y-4 p-6">
            {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
            {message && <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">{message}</p>}
            <form onSubmit={(event) => { event.preventDefault(); saveClinicalReview(event.currentTarget); }} className="space-y-4">
              <div className="rounded-xl border border-gray-300 bg-gray-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label htmlFor="psych-clinical-summary" className="font-semibold text-[#2D2D2D]">{t('confidentialTitle')}</label>
                  <span className="rounded-full bg-gray-800 px-2.5 py-0.5 text-xs font-semibold text-white">{t('confidentialBadge')}</span>
                </div>
                <p className="mt-1 text-xs text-gray-600">{t('confidentialHint')}</p>
                <textarea id="psych-clinical-summary" name="clinical_summary" defaultValue={clinicalSummary} disabled={!canEdit} rows={6} placeholder={t('confidentialPlaceholder')} className="mt-3 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-[#C0172C] focus:outline-none focus:ring-2 focus:ring-red-100 disabled:bg-gray-100" />
              </div>
              <div className="rounded-xl border border-green-200 bg-green-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label htmlFor="psych-athlete-summary" className="font-semibold text-[#2D2D2D]">{t('athleteSummaryTitle')}</label>
                  <span className="rounded-full bg-green-700 px-2.5 py-0.5 text-xs font-semibold text-white">{t('athleteSummaryBadge')}</span>
                </div>
                <p className="mt-1 text-xs text-green-900">{t('athleteSummaryHint')}</p>
                <textarea id="psych-athlete-summary" name="athlete_summary" defaultValue={athleteSummary} disabled={!canEdit} rows={6} placeholder={t('athleteSummaryPlaceholder')} className="mt-3 w-full rounded-lg border border-green-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-100 disabled:bg-gray-100" />
              </div>
              {canEdit && <div className="flex justify-end"><button type="submit" disabled={isSaving} className="rounded-lg border border-[#C0172C] px-3 py-2 text-sm font-semibold text-[#C0172C] hover:bg-red-50 disabled:opacity-60">{isSaving ? tc('saving') : t('saveSummary')}</button></div>}
            </form>
            {scores.length === 0 ? <p className="text-sm text-gray-500">{t('noAutomatedScoring')}</p> : scores.map((score) => (
              <form key={score.id} onSubmit={(event) => { event.preventDefault(); saveInterpretation(score.id, event.currentTarget); }} className="rounded-xl border border-gray-200 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-[#2D2D2D]">{psychLabel(tc, 'subscale', score.subscaleCode)}</p>
                    <p className="mt-1 text-sm text-gray-600">{t('score', { score: score.rawScore })}</p>
                  </div>
                  <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-[#C0172C]">{score.band ? psychLabel(tc, 'band', score.band) : t('noBand')}</span>
                </div>
                <textarea name="interpretation_text" defaultValue={score.interpretationText ?? ''} disabled={!canEdit} rows={4} placeholder={t('interpretationPlaceholder')} className="mt-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:border-[#C0172C] focus:outline-none focus:ring-2 focus:ring-red-100 disabled:bg-gray-50" />
                {canEdit && <div className="mt-3 flex justify-end"><button type="submit" disabled={isSaving} className="rounded-lg border border-[#C0172C] px-3 py-2 text-sm font-semibold text-[#C0172C] hover:bg-red-50 disabled:opacity-60">{isSaving ? tc('saving') : t('saveInterpretation')}</button></div>}
              </form>
            ))}
            {assessmentStatus === 'under_review' && canEdit && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm text-amber-900">{t('approveHint')}</p>
                <button type="button" onClick={approve} disabled={isApproving || !athleteSummary.trim()} className="rounded-lg bg-[#C0172C] px-4 py-2 text-sm font-semibold text-white hover:bg-[#C1000E] disabled:opacity-60">{isApproving ? t('approving') : t('approve')}</button>
              </div>
            )}
            {(reviewedAt || approvedAt) && <p className="text-xs text-gray-500">{t('timeline', {
              reviewed: reviewedAt ? new Date(reviewedAt).toLocaleString(dateLocale) : t('pending'),
              approved: approvedAt ? new Date(approvedAt).toLocaleString(dateLocale) : t('pending'),
            })}</p>}
          </div>
        </section>
      </div>
    </div>
  );
}
