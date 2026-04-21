'use client';

import { useRef, useState, useTransition, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { createNutritionPlan } from './actions';

type Person = {
  id: string;
  first_name: string;
  last_name: string;
};

export default function NewPlanForm({
  athletes,
  nutritionists,
}: {
  athletes: Person[];
  nutritionists: Person[];
}) {
  const t = useTranslations('followUp.nutrition');
  const tc = useTranslations('common');

  const searchParams   = useSearchParams();
  const newPlanParam   = searchParams.get('new_plan') === '1';
  const athleteParam   = searchParams.get('athlete') ?? '';
  const planTitleParam = decodeURIComponent(searchParams.get('plan_title') ?? '');

  const [open, setOpen] = useState(newPlanParam);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const formRef    = useRef<HTMLFormElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (newPlanParam) {
      setOpen(true);
      setTimeout(() => {
        wrapperRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }, [newPlanParam]);

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await createNutritionPlan(formData);
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
          {t('newPlan')}
        </button>
      ) : (
        <div className="rounded-lg border border-gray-200 p-5">
          <h2 className="font-semibold mb-4">{t('newPlanTitle')}</h2>

          {error && (
            <p className="mb-4 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </p>
          )}

          {planTitleParam && (
            <div className="mb-4 flex items-start gap-2 rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-2.5">
              <span className="text-sm">📋</span>
              <p className="text-xs text-indigo-700">
                <span className="font-semibold">Seguimiento del plan:</span>{' '}
                {planTitleParam}
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
                  defaultValue={athleteParam}
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
                <label className="block text-sm font-medium mb-1" htmlFor="nutritionist_profile_id">
                  {t('nutritionistLabel')} <span className="text-red-500">*</span>
                </label>
                <select
                  id="nutritionist_profile_id"
                  name="nutritionist_profile_id"
                  required
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="">{t('selectNutritionist')}</option>
                  {nutritionists.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.first_name} {n.last_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
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
                <label className="block text-sm font-medium mb-1" htmlFor="start_date">
                  {t('startDateLabel')} <span className="text-red-500">*</span>
                </label>
                <input
                  id="start_date"
                  name="start_date"
                  type="date"
                  required
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" htmlFor="end_date">
                  {t('endDateLabel')}
                </label>
                <input
                  id="end_date"
                  name="end_date"
                  type="date"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" htmlFor="status">
                  {t('statusLabel')}
                </label>
                <select
                  id="status"
                  name="status"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="active">{t('statusActive')}</option>
                  <option value="completed">{t('statusCompleted')}</option>
                  <option value="paused">{t('statusPaused')}</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={isPending}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
              {isPending ? tc('saving') : t('savePlan')}
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
