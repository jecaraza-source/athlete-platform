'use client';

import { useState, useTransition } from 'react';
import { savePsychInstrumentLicense } from '@/app/[locale]/(app)/dashboard/mental-health/actions';

type LicenseStatus = 'pending_review' | 'licensed' | 'not_required' | 'denied';

type Instrument = {
  id: string;
  code: string;
  name: string;
  licenseStatus: LicenseStatus;
  licenseNotes: string;
};

const STATUS_LABELS: Record<LicenseStatus, string> = {
  pending_review: 'Pendiente de revisión',
  licensed: 'Licenciado',
  not_required: 'No requerido',
  denied: 'Denegado',
};

const STATUS_STYLES: Record<LicenseStatus, string> = {
  pending_review: 'bg-amber-50 text-amber-800 ring-amber-200',
  licensed: 'bg-green-50 text-green-800 ring-green-200',
  not_required: 'bg-sky-50 text-sky-800 ring-sky-200',
  denied: 'bg-red-50 text-red-800 ring-red-200',
};

export function LicenseStatusManager({ instruments }: { instruments: Instrument[] }) {
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function save(instrument: Instrument, form: HTMLFormElement) {
    const data = new FormData(form);
    setPendingId(instrument.id);
    startTransition(async () => {
      const result = await savePsychInstrumentLicense({
        instrumentId: instrument.id,
        status: String(data.get('status')),
        notes: String(data.get('notes') ?? ''),
      });
      setError(result.error ?? null);
      setPendingId(null);
    });
  }

  return (
    <div className="space-y-4">
      {error && <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
      {instruments.map((instrument) => (
        <form
          key={instrument.id}
          onSubmit={(event) => {
            event.preventDefault();
            save(instrument, event.currentTarget);
          }}
          className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#C0172C]">{instrument.code}</p>
              <h2 className="mt-1 font-bold text-[#2D2D2D]">{instrument.name}</h2>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${STATUS_STYLES[instrument.licenseStatus]}`}>
              {STATUS_LABELS[instrument.licenseStatus]}
            </span>
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-[180px_minmax(240px,2fr)_auto]">
            <select name="status" defaultValue={instrument.licenseStatus} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-[#C0172C] focus:outline-none focus:ring-2 focus:ring-red-100">
              {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <textarea name="notes" defaultValue={instrument.licenseNotes} rows={2} placeholder="Notas, enlace a licencia o alcance de la autorización…" className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:border-[#C0172C] focus:outline-none focus:ring-2 focus:ring-red-100" />
            <button type="submit" disabled={isPending && pendingId === instrument.id} className="self-start rounded-lg border border-[#C0172C] px-3 py-2 text-sm font-semibold text-[#C0172C] transition hover:bg-red-50 disabled:opacity-60">
              {isPending && pendingId === instrument.id ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </form>
      ))}
    </div>
  );
}
