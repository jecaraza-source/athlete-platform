'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import ShowForm from './ShowForm';
import NoShowForm from './NoShowForm';
import RescheduleCalendar from './RescheduleCalendar';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AttendanceStatus = 'show' | 'no_show' | 'reschedule' | null;

type Props = {
  eventId: string;
  specialistId: string;
  serviceType: string;
  athleteId: string;
  athleteProfileId: string | null;
  startAt: string;
  endAt: string;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AttendanceActions({
  eventId,
  specialistId,
  serviceType,
  athleteId,
  athleteProfileId,
  startAt,
  endAt,
}: Props) {
  const router = useRouter();
  const [selected, setSelected]         = useState<AttendanceStatus>(null);
  const [feedback, setFeedback]         = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [rescheduleNotes, setRescheduleNotes] = useState('');

  function select(status: AttendanceStatus) {
    setSelected(status);
    setFeedback(null);
  }

  function handleSuccess() {
    setFeedback({ type: 'success', msg: '✅ Acción registrada correctamente.' });
    // Refresh the page after a short delay so the read-only view appears
    setTimeout(() => router.refresh(), 800);
  }

  function handleError(msg: string) {
    setFeedback({ type: 'error', msg: `Error: ${msg}` });
  }

  // Called from NoShowForm when user clicks "Sí, abrir calendario"
  function switchToReschedule(prefill: string) {
    setRescheduleNotes(prefill);
    setSelected('reschedule');
  }

  const btnBase =
    'flex-1 flex flex-col sm:flex-row items-center justify-center gap-2 h-16 rounded-xl font-semibold text-base transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 sm:text-lg';

  const activeRing: Record<NonNullable<AttendanceStatus>, string> = {
    show:       'ring-2 ring-emerald-500 ring-offset-2 shadow-lg scale-[1.02]',
    no_show:    'ring-2 ring-red-500    ring-offset-2 shadow-lg scale-[1.02]',
    reschedule: 'ring-2 ring-amber-500  ring-offset-2 shadow-lg scale-[1.02]',
  };

  return (
    <div className="mt-4">
      {/* Section header */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="px-5 pt-4 pb-2 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800">Registro de asistencia</h2>
        </div>

        {/* Feedback banner */}
        {feedback && (
          <div
            className={`mx-5 mt-4 rounded-lg px-4 py-3 text-sm font-medium ${
              feedback.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}
          >
            {feedback.msg}
          </div>
        )}

        {/* 3 action buttons */}
        <div className="p-5 flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={() => select('show')}
            aria-pressed={selected === 'show'}
            className={`${btnBase} bg-emerald-600 text-white hover:bg-emerald-500 focus:ring-emerald-500 ${
              selected === 'show' ? activeRing.show : ''
            }`}
          >
            <span className="text-xl">✅</span>
            <span>Atendió</span>
          </button>

          <button
            type="button"
            onClick={() => select('no_show')}
            aria-pressed={selected === 'no_show'}
            className={`${btnBase} bg-red-600 text-white hover:bg-red-500 focus:ring-red-500 ${
              selected === 'no_show' ? activeRing.no_show : ''
            }`}
          >
            <span className="text-xl">❌</span>
            <span>No atendió</span>
          </button>

          <button
            type="button"
            onClick={() => select('reschedule')}
            aria-pressed={selected === 'reschedule'}
            className={`${btnBase} bg-amber-600 text-white hover:bg-amber-500 focus:ring-amber-500 ${
              selected === 'reschedule' ? activeRing.reschedule : ''
            }`}
          >
            <span className="text-xl">🔄</span>
            <span>Reagendar</span>
          </button>
        </div>
      </div>

      {/* Conditional form area — appears below the buttons with smooth transition */}
      {selected === 'show' && (
        <ShowForm
          eventId={eventId}
          initialNotes=""
          onSuccess={handleSuccess}
          onError={handleError}
        />
      )}

      {selected === 'no_show' && (
        <NoShowForm
          eventId={eventId}
          athleteProfileId={athleteProfileId}
          onSuccess={handleSuccess}
          onError={handleError}
          onSwitchToReschedule={switchToReschedule}
        />
      )}

      {selected === 'reschedule' && (
        <RescheduleCalendar
          eventId={eventId}
          specialistId={specialistId}
          serviceType={serviceType}
          athleteId={athleteId}
          athleteProfileId={athleteProfileId}
          originalStartAt={startAt}
          originalEndAt={endAt}
          prefillNotes={rescheduleNotes}
          onSuccess={handleSuccess}
          onError={handleError}
          onCancel={() => select(null)}
        />
      )}
    </div>
  );
}
