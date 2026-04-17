'use client';

import { useState, useTransition, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { createTicket } from '../actions';

export default function NewTicketForm() {
  const t = useTranslations('admin.tickets');
  const tc = useTranslations('common');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await createTicket(formData);
      if (result.error) {
        setError(result.error);
      } else {
        setError(null);
        router.push(
          result.ticketId ? `/admin/tickets/${result.ticketId}` : '/admin/tickets'
        );
      }
    });
  }

  return (
    <form ref={formRef} action={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded border border-red-300 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Title */}
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
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium mb-1" htmlFor="description">
          {t('descriptionLabel')}
        </label>
        <textarea
          id="description"
          name="description"
          rows={6}
          placeholder={t('descPlaceholder')}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Priority */}
      <div>
        <label className="block text-sm font-medium mb-1" htmlFor="priority">
          {t('priorityLabel')}
        </label>
        <select
          id="priority"
          name="priority"
          defaultValue="medium"
          className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="low">{t('formPriorityLow')}</option>
          <option value="medium">{t('formPriorityMedium')}</option>
          <option value="high">{t('formPriorityHigh')}</option>
          <option value="urgent">{t('formPriorityUrgent')}</option>
        </select>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {isPending ? tc('creating') : t('createTicket')}
        </button>
        <a
          href="/admin/tickets"
          className="rounded-md border border-gray-300 px-5 py-2 text-sm font-medium hover:bg-gray-50 transition-colors"
        >
          {tc('cancel')}
        </a>
      </div>
    </form>
  );
}
