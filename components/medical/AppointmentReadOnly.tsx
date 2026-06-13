'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { autosaveNotes } from '@/app/[locale]/(app)/medical/appointments/[eventId]/actions';
import type { AppointmentEvent } from '@/app/[locale]/(app)/medical/appointments/[eventId]/page';

type ConfirmedByRow = { first_name: string; last_name: string } | null;

type Props = {
  event: AppointmentEvent;
  confirmedBy: ConfirmedByRow;
  canEdit: boolean;
  currentUserId: string;
};

const STATUS_CONFIG: Record<string, { icon: string; label: string; bg: string; text: string; border: string }> = {
  show: {
    icon:   '✅',
    label:  'ATENDIDA',
    bg:     'bg-emerald-50',
    text:   'text-emerald-800',
    border: 'border-emerald-200',
  },
  no_show: {
    icon:   '❌',
    label:  'NO ASISTIÓ',
    bg:     'bg-red-50',
    text:   'text-red-800',
    border: 'border-red-200',
  },
  rescheduled: {
    icon:   '🔄',
    label:  'REAGENDADA',
    bg:     'bg-amber-50',
    text:   'text-amber-800',
    border: 'border-amber-200',
  },
  cancelled: {
    icon:   '🚫',
    label:  'CANCELADA',
    bg:     'bg-gray-50',
    text:   'text-gray-700',
    border: 'border-gray-200',
  },
};

const NO_SHOW_REASON_LABEL: Record<string, string> = {
  no_notice:   'Sin aviso previo',
  gave_notice: 'Avisó con anticipación',
  emergency:   'Emergencia personal',
  other:       'Otro motivo',
};

export default function AppointmentReadOnly({ event, confirmedBy, canEdit }: Props) {
  const router = useRouter();
  const [editing, setEditing]   = useState(false);
  const [notes, setNotes]       = useState(event.description ?? '');
  const [saving, setSaving]     = useState(false);
  const [saveMsg, setSaveMsg]   = useState('');

  const config = STATUS_CONFIG[event.status] ?? STATUS_CONFIG.show;

  const confirmedAt = event.confirmed_at
    ? new Date(event.confirmed_at).toLocaleString('es-MX', {
        day:    'numeric',
        month:  'long',
        year:   'numeric',
        hour:   '2-digit',
        minute: '2-digit',
      })
    : null;

  async function handleSaveNotes() {
    setSaving(true);
    setSaveMsg('');
    const result = await autosaveNotes(event.id, notes);
    setSaving(false);
    if (result?.error) {
      setSaveMsg(`Error: ${result.error}`);
    } else {
      setSaveMsg('✓ Notas actualizadas.');
      setEditing(false);
      router.refresh();
    }
  }

  return (
    <div className={`mt-4 rounded-xl border ${config.border} ${config.bg} p-5 space-y-4 transition-all`}>
      {/* Status banner */}
      <div className={`flex items-center gap-3 ${config.text}`}>
        <span className="text-2xl">{config.icon}</span>
        <div>
          <p className="font-bold text-lg">Esta cita fue marcada como {config.label}</p>
          {confirmedAt && (
            <p className="text-sm opacity-80">
              {confirmedBy
                ? `Por: ${confirmedBy.first_name} ${confirmedBy.last_name}  ·  `
                : ''}
              {confirmedAt}
            </p>
          )}
        </div>
      </div>

      {/* No-show reason */}
      {event.status === 'no_show' && event.no_show_reason && (
        <div className="rounded-lg border border-red-200 bg-white px-4 py-3">
          <p className="text-xs font-medium text-gray-500 mb-1">Motivo registrado</p>
          <p className="text-sm text-gray-800">
            {NO_SHOW_REASON_LABEL[event.no_show_reason] ?? event.no_show_reason}
          </p>
        </div>
      )}

      {/* Reschedule reason */}
      {event.status === 'rescheduled' && event.reschedule_reason && (
        <div className="rounded-lg border border-amber-200 bg-white px-4 py-3">
          <p className="text-xs font-medium text-gray-500 mb-1">Motivo del reagendamiento</p>
          <p className="text-sm text-gray-800">{event.reschedule_reason}</p>
        </div>
      )}

      {/* Notes section */}
      <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            Notas registradas
          </p>
          {canEdit && !editing && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="text-xs font-medium text-indigo-600 hover:text-indigo-800 hover:underline"
            >
              ✎ Editar notas
            </button>
          )}
        </div>

        {editing ? (
          <div className="space-y-3">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={5}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 resize-y focus:outline-none focus:ring-2 focus:ring-indigo-400 transition"
              style={{ minHeight: '100px' }}
            />
            {saveMsg && (
              <p className={`text-xs ${saveMsg.startsWith('Error') ? 'text-red-600' : 'text-emerald-600'}`}>
                {saveMsg}
              </p>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleSaveNotes}
                disabled={saving}
                className="rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors"
              >
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
              <button
                type="button"
                onClick={() => { setEditing(false); setNotes(event.description ?? ''); setSaveMsg(''); }}
                className="rounded-lg border border-gray-300 px-4 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-700 whitespace-pre-wrap">
            {notes || <span className="text-gray-400 italic">Sin notas registradas.</span>}
          </p>
        )}
      </div>
    </div>
  );
}
