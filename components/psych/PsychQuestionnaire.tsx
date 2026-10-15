'use client';

import { FormEvent, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import type { AthleteQuestionnaireItem } from '@/lib/psych/questionnaire';

type ResponseOption = {
  value: string;
  label: string;
};

type Props = {
  assessmentId: string;
  instrumentName: string;
  items: AthleteQuestionnaireItem[];
};

function normaliseOptions(value: unknown): ResponseOption[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((option) => {
    if (typeof option === 'string' || typeof option === 'number') {
      const normalised = String(option);
      return [{ value: normalised, label: normalised }];
    }
    if (
      option &&
      typeof option === 'object' &&
      'value' in option &&
      typeof option.value === 'string'
    ) {
      return [{
        value: option.value,
        label: 'label' in option && typeof option.label === 'string'
          ? option.label
          : option.value,
      }];
    }
    return [];
  });
}

export function PsychQuestionnaire({ assessmentId, instrumentName, items }: Props) {
  const t = useTranslations('psych.athlete');
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [isPending, startTransition] = useTransition();

  // The API answers in a single language for web and mobile alike, so the
  // web client maps its outcome to the viewer's locale.
  function submissionErrorMessage(status: number, code: unknown) {
    if (status === 409) return code === 'NOT_YET_AVAILABLE' ? t('notAvailableYet') : t('alreadyAnswered');
    if (status === 404) return t('noLongerAvailable');
    if (status === 400) return t('invalidAnswers');
    return t('submitError');
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const responses = items.map((item) => ({
      item_code: item.item_code,
      raw_value: String(formData.get(item.item_code) ?? ''),
    }));

    if (responses.some((response) => !response.raw_value)) {
      setError(t('answerAll'));
      setMessage(null);
      return;
    }

    startTransition(async () => {
      try {
        const response = await fetch(`/api/psych/assessments/${assessmentId}/responses`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ responses }),
        });
        const result = await response.json().catch(() => ({}));

        if (!response.ok) {
          setError(submissionErrorMessage(response.status, result.code));
          setMessage(null);
          return;
        }

        // Scores and bands are only released after clinical review, never here.
        setError(null);
        if (result.isTestRun) {
          setMessage(t('testRunSubmitted'));
          setSubmitted(true);
          return;
        }
        // Reload so the answered-tests record includes this assessment.
        router.replace('/dashboard/psych?submitted=1');
      } catch {
        setError(t('connectionError'));
        setMessage(null);
      }
    });
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border border-red-100 bg-white shadow-sm">
      <div className="border-b border-red-100 bg-red-50 px-6 py-5">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#C0172C]">{t('questionnaireEyebrow')}</p>
        <h2 className="mt-1 text-xl font-bold text-[#2D2D2D]">{instrumentName}</h2>
        <p className="mt-1 text-sm text-gray-600">{t('confidential')}</p>
      </div>

      <div className="space-y-6 p-6">
        {error && <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
        {message && <p className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">{message}</p>}
        {!submitted && items.map((item) => {
          const options = normaliseOptions(item.response_options);
          return (
            <fieldset key={item.item_code} className="border-b border-gray-100 pb-5 last:border-0 last:pb-0">
              <legend className="text-sm font-semibold text-[#2D2D2D]">
                <span className="mr-2 text-[#C0172C]">{item.item_order}.</span>
                {item.prompt_text}
              </legend>
              <div className="mt-3 flex flex-wrap gap-2">
                {options.map((option) => (
                  <label
                    key={option.value}
                    className="cursor-pointer rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 transition hover:border-[#C0172C] hover:bg-red-50 has-[:checked]:border-[#C0172C] has-[:checked]:bg-red-50 has-[:checked]:text-[#C0172C]"
                  >
                    <input className="sr-only" type="radio" name={item.item_code} value={option.value} />
                    {option.label}
                  </label>
                ))}
              </div>
            </fieldset>
          );
        })}
      </div>

      {!submitted && <div className="flex justify-end border-t border-gray-100 px-6 py-4">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-[#C0172C] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#C1000E] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? t('submitting') : t('submit')}
        </button>
      </div>}
    </form>
  );
}
