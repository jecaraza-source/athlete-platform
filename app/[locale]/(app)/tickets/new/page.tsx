'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter }                         from 'next/navigation';
import { useTranslations }                  from 'next-intl';
import { createMyTicket }                    from '../actions';
import BackButton                            from '@/components/back-button';

// Priority options are resolved inside the component using t()

export default function NewTicketPage() {
  const router = useRouter();
  const t = useTranslations('athleteTickets');
  const formRef = useRef<HTMLFormElement>(null);

  const PRIORITY_OPTIONS = [
    { value: 'low',    label: t('priorityLow') },
    { value: 'medium', label: t('priorityMedium') },
    { value: 'high',   label: t('priorityHigh') },
    { value: 'urgent', label: t('priorityUrgent') },
  ];

  const [error, setError]   = useState<string | null>(null);
  const [isPending, start]  = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    start(async () => {
      const result = await createMyTicket(formData);
      if (result.error) {
        setError(result.error);
      } else {
        router.push(result.ticketId ? `/tickets/${result.ticketId}` : '/tickets');
      }
    });
  }

  return (
    <main className="p-8 max-w-2xl">
      <BackButton href="/tickets" label={t('backToTickets')} />

      <h1 className="text-2xl font-bold text-teal-700 mt-4 mb-2">{t('newTitle')}</h1>
      <p className="text-sm text-gray-500 mb-8">{t('newDesc')}</p>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        {error && (
          <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <form ref={formRef} action={handleSubmit} className="space-y-5">

          {/* Título */}
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
              {t('titleLabel')} <span className="text-red-500">{t('titleRequired')}</span>
            </label>
            <input
              id="title"
              name="title"
              type="text"
              required
              placeholder={t('titlePlaceholder')}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
            />
          </div>

          {/* Descripción */}
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
              {t('descriptionLabel')} <span className="text-gray-400 font-normal">{t('descriptionOptional')}</span>
            </label>
            <textarea
              id="description"
              name="description"
              rows={5}
              placeholder={t('descriptionPlaceholder')}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm resize-y focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
            />
          </div>

          {/* Prioridad */}
          <div>
            <label htmlFor="priority" className="block text-sm font-medium text-gray-700 mb-1">
              {t('priorityLabel')}
            </label>
            <select
              id="priority"
              name="priority"
              defaultValue="medium"
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
            >
              {PRIORITY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* Acciones */}
          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={isPending}
              className="rounded-lg bg-teal-600 px-5 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50 transition-colors"
            >
              {isPending ? t('submitting') : t('submit')}
            </button>
            <button
              type="button"
              onClick={() => router.back()}
              className="rounded-lg border border-gray-300 px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              {t('cancel')}
            </button>
          </div>

        </form>
      </div>
    </main>
  );
}
