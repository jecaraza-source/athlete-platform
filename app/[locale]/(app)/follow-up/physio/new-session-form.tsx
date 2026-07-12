'use client';

import { useRef, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { createPhysioSession } from './actions';

type PhysioCase = {
  id: string;
  label: string;
};

export default function NewPhysioSessionForm({ cases }: { cases: PhysioCase[] }) {
  const t  = useTranslations('followUp.physio');
  const tc = useTranslations('common');
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await createPhysioSession(formData);
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
    <div>
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 transition-colors"
        >
          {t('addSessionBtn')}
        </button>
      ) : (
        <div className="rounded-lg border border-gray-200 p-4 mt-2">
          <h3 className="font-semibold mb-3 text-sm">{t('newSessionTitle')}</h3>

          {error && (
            <p className="mb-3 rounded border border-red-300 bg-red-50 p-2 text-xs text-red-700">
              {error}
            </p>
          )}

          <form ref={formRef} action={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1" htmlFor="physio_case_id">
                  {t('caseLabel')} <span className="text-red-500">*</span>
                </label>
                <select
                  id="physio_case_id"
                  name="physio_case_id"
                  required
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="">{t('selectCase')}</option>
                  {cases.map((c) => (
                    <option key={c.id} value={c.id}>{c.label}</option>
                  ))}
                </select>
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
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1" htmlFor="pain_score">{t('painLabel')}</label>
                <input
                  id="pain_score"
                  name="pain_score"
                  type="number"
                  min="1"
                  max="10"
                  step="1"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" htmlFor="mobility_score">{t('mobilityLabel')}</label>
                <input
                  id="mobility_score"
                  name="mobility_score"
                  type="number"
                  min="1"
                  max="10"
                  step="1"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" htmlFor="next_session_date">{t('nextSessionDateLabel')}</label>
                <input
                  id="next_session_date"
                  name="next_session_date"
                  type="date"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1" htmlFor="treatment_summary">
                {t('treatmentLabel')} <span className="text-red-500">*</span>
              </label>
              <textarea
                id="treatment_summary"
                name="treatment_summary"
                rows={2}
                required
                placeholder={t('treatmentPlaceholder')}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1" htmlFor="notes">{t('notesLabel')}</label>
              <textarea
                id="notes"
                name="notes"
                rows={2}
                placeholder={t('obsPlaceholder')}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={isPending}
                className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {isPending ? tc('saving') : tc('save')}
              </button>
              <button
                type="button"
                onClick={() => { setOpen(false); setError(null); }}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium hover:bg-gray-50 transition-colors"
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
