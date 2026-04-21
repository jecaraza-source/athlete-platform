'use client';

import { useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { updateEventStatus } from './actions';

export default function EventStatusSelect({
  eventId,
  currentStatus,
}: {
  eventId: string;
  currentStatus: string;
}) {
  const t = useTranslations('calendar');
  const STATUSES = [
    { value: 'scheduled', label: t('statusScheduled') },
    { value: 'completed', label: t('statusCompleted')  },
    { value: 'cancelled', label: t('statusCancelled')  },
  ];
  const [isPending, startTransition] = useTransition();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newStatus = e.target.value;
    startTransition(async () => {
      await updateEventStatus(eventId, newStatus);
    });
  }

  return (
    <select
      value={currentStatus}
      onChange={handleChange}
      disabled={isPending}
      className="rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
    >
      {STATUSES.map((s) => (
        <option key={s.value} value={s.value}>
          {s.label}
        </option>
      ))}
    </select>
  );
}
