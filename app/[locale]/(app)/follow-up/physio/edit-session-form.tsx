'use client';

import { useRef, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { updatePhysioSession } from './actions';

type Session = {
  id: string;
  session_date: string;
  treatment_summary: string | null;
  pain_score: number | null;
  mobility_score: number | null;
  notes: string | null;
  next_session_date: string | null;
};

export default function EditSessionForm({ session }: { session: Session }) {
  const t  = useTranslations('followUp.physio');
  const tc = useTranslations('common');
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await updatePhysioSession(session.id, formData);
      if (result.error) {
        setError(result.error);
      } else {
        setError(null);
        setEditing(false);
      }
    });
  }

  if (!editing) {
    return (
      <div className="rounded-md border border-gray-100 bg-gray-50 px-3 py-2.5 text-sm">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
          <span className="font-medium text-gray-700">
            {new Date(session.session_date).toLocaleDateString()}
          </span>
          {session.pain_score != null && (
            <span className="text-xs text-gray-500">{t('painDisplay')} <span className="font-medium text-gray-700">{session.pain_score}/10</span></span>
          )}
          {session.mobility_score != null && (
            <span className="text-xs text-gray-500">{t('mobilityDisplay')} <span className="font-medium text-gray-700">{session.mobility_score}/10</span></span>
          )}
          {session.next_session_date && (
            <span className="text-xs text-gray-500">{t('nextDisplay')} <span className="font-medium text-gray-700">{new Date(session.next_session_date).toLocaleDateString()}</span></span>
          )}
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="ml-auto text-xs text-blue-600 hover:underline"
          >
            {tc('edit')}
          </button>
        </div>
        {session.treatment_summary && (
          <p className="mt-1 text-xs text-gray-600">{session.treatment_summary}</p>
        )}
        {session.notes && (
          <p className="mt-0.5 text-xs text-gray-400 italic">{session.notes}</p>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-3 text-sm">
      {error && (
        <p className="mb-2 rounded border border-red-300 bg-red-50 p-2 text-xs text-red-700">{error}</p>
      )}
      <form ref={formRef} action={handleSubmit} className="space-y-2">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <div>
            <label className="block text-xs font-medium mb-0.5">{t('dateLabel')} <span className="text-red-500">*</span></label>
            <input
              name="session_date"
              type="date"
              required
              defaultValue={session.session_date}
              className="w-full rounded border border-gray-300 px-2 py-1 text-xs"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-0.5">{t('painLabel')}</label>
            <input
              name="pain_score"
              type="number"
              min="1"
              max="10"
              step="1"
              defaultValue={session.pain_score ?? ''}
              className="w-full rounded border border-gray-300 px-2 py-1 text-xs"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-0.5">{t('mobilityLabel')}</label>
            <input
              name="mobility_score"
              type="number"
              min="1"
              max="10"
              step="1"
              defaultValue={session.mobility_score ?? ''}
              className="w-full rounded border border-gray-300 px-2 py-1 text-xs"
            />
          </div>
          <div className="col-span-2 sm:col-span-3">
            <label className="block text-xs font-medium mb-0.5">{t('nextSessionDateLabel')}</label>
            <input
              name="next_session_date"
              type="date"
              defaultValue={session.next_session_date ?? ''}
              className="w-full rounded border border-gray-300 px-2 py-1 text-xs"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium mb-0.5">{t('treatmentLabel')}</label>
          <textarea
            name="treatment_summary"
            rows={2}
            defaultValue={session.treatment_summary ?? ''}
            className="w-full rounded border border-gray-300 px-2 py-1 text-xs resize-none"
          />
        </div>
        <div>
          <label className="block text-xs font-medium mb-0.5">{t('notesLabel')}</label>
          <textarea
            name="notes"
            rows={2}
            defaultValue={session.notes ?? ''}
            className="w-full rounded border border-gray-300 px-2 py-1 text-xs resize-none"
          />
        </div>
        <div className="flex gap-2 pt-1">
          <button
            type="submit"
            disabled={isPending}
            className="rounded bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {isPending ? tc('saving') : t('doneBtn')}
          </button>
          <button
            type="button"
            onClick={() => { setEditing(false); setError(null); }}
            className="rounded border border-gray-300 px-3 py-1 text-xs font-medium hover:bg-gray-50 transition-colors"
          >
            {tc('cancel')}
          </button>
        </div>
      </form>
    </div>
  );
}
