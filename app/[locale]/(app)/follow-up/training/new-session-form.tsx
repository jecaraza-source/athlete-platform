'use client';

import { useRef, useState, useTransition, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { createTrainingSession } from './actions';

type Person = {
  id: string;
  first_name: string;
  last_name: string;
};

export default function NewSessionForm({
  athletes,
  coaches,
  defaultOpen = false,
  initialAthleteId = '',
  initialPlanTitle = '',
}: {
  athletes: Person[];
  coaches: Person[];
  defaultOpen?: boolean;
  initialAthleteId?: string;
  initialPlanTitle?: string;
}) {
  const t = useTranslations('followUp.training');
  const tc = useTranslations('common');
  const [open, setOpen] = useState(defaultOpen);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Open and scroll into view when defaultOpen prop changes to true
  useEffect(() => {
    if (defaultOpen) {
      setOpen(true);
      // Small delay to allow the form to render before scrolling
      setTimeout(() => {
        wrapperRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 50);
    }
  }, [defaultOpen]);

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await createTrainingSession(formData);
      if (result.error) {
        setError(result.error);
      } else {
        setError(null);
        setOpen(false);
        formRef.current?.reset();
      }
    });
  }

  return (
    <div className="mb-8" ref={wrapperRef}>
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          {t('newSession')}
        </button>
      ) : (
        <div className="rounded-lg border border-gray-200 p-5">
          <h2 className="font-semibold mb-4">{t('newSessionTitle')}</h2>

          {error && (
            <p className="mb-4 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </p>
          )}

          {initialPlanTitle && (
            <div className="mb-4 flex items-start gap-2 rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-2.5">
              <span className="text-sm">📋</span>
              <p className="text-xs text-indigo-700">
                <span className="font-semibold">Seguimiento del plan:</span>{' '}
                {initialPlanTitle}
              </p>
            </div>
          )}

          <form ref={formRef} action={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1" htmlFor="athlete_id">
                  {t('athleteLabel')} <span className="text-red-500">*</span>
                </label>
                <select
                  id="athlete_id"
                  name="athlete_id"
                  required
                  defaultValue={initialAthleteId}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="">{t('selectAthlete')}</option>
                  {athletes.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.first_name} {a.last_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" htmlFor="coach_profile_id">
                  {t('coachLabel')} <span className="text-red-500">*</span>
                </label>
                <select
                  id="coach_profile_id"
                  name="coach_profile_id"
                  required
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="">{t('selectCoach')}</option>
                  {coaches.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.first_name} {c.last_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" htmlFor="title">
                  {t('titleLabel')} <span className="text-red-500">*</span>
                </label>
                <input
                  id="title"
                  name="title"
                  type="text"
                  required
                  placeholder={t('titlePlaceholder')}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" htmlFor="session_date">
                  {t('dateLabel')} <span className="text-red-500">*</span>
                </label>
                <input
                  id="session_date"
                  name="session_date"
                  type="date"
                  required
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" htmlFor="location">
                  {t('location')}
                </label>
                <input
                  id="location"
                  name="location"
                  type="text"
                  placeholder={t('locationPlaceholder')}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" htmlFor="start_time">
                  {t('startTimeLabel')}
                </label>
                <input
                  id="start_time"
                  name="start_time"
                  type="time"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" htmlFor="end_time">
                  {t('endTimeLabel')}
                </label>
                <input
                  id="end_time"
                  name="end_time"
                  type="time"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1" htmlFor="notes">
                {t('notes')}
              </label>
              <textarea
                id="notes"
                name="notes"
                rows={3}
                defaultValue={initialPlanTitle ? `Seguimiento del plan: ${initialPlanTitle}` : ''}
                placeholder={t('notesPlaceholder')}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={isPending}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
              {isPending ? tc('saving') : t('saveSession')}
              </button>
              <button
                type="button"
                onClick={() => { setOpen(false); setError(null); }}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                {tc('cancel')}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
