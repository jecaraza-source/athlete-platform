'use client';

import { useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { updateEventStatus } from './actions';

// Statuses that are owned by /medical/appointments and should not be overwritten
// from the calendar module.
const MEDICAL_STATUS_LABELS: Record<string, string> = {
  show:           '✅ Atendida',
  no_show:        '❌ No asistió',
  no_show_remote: '📞 Llamada/Mensaje',
  rescheduled:    '🔄 Reagendada',
};

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

  // If the event was registered via the medical module, show a read-only badge
  // instead of a dropdown. Allowing changes here would silently overwrite the
  // attendance record saved by the doctor.
  if (currentStatus in MEDICAL_STATUS_LABELS) {
    return (
      <span
        title="Estado registrado por el módulo médico (Mis Citas)"
        className="rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-xs font-medium text-gray-500 cursor-default select-none"
      >
        {MEDICAL_STATUS_LABELS[currentStatus]}
      </span>
    );
  }

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
