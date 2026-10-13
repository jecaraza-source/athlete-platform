'use client';

import { useState, useTransition } from 'react';
import { setPsychInstrumentActive } from '@/app/[locale]/(app)/dashboard/mental-health/actions';

type Instrument = {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  licenseStatus: string;
};
const LICENSE_STATUS_LABELS: Record<string, string> = {
  pending_review: 'Pendiente de revisión',
  licensed: 'Licenciado',
  not_required: 'No requerido',
  denied: 'Denegado',
};

export function PsychInstrumentCatalog({ instruments }: { instruments: Instrument[] }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  function toggle(instrument: Instrument) {
    startTransition(async () => {
      const result = await setPsychInstrumentActive({ instrumentId: instrument.id, isActive: !instrument.isActive });
      setError(result.error ?? null);
    });
  }
  return (
    <section className="mt-10">
      <div className="mb-4"><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#C0172C]">Catálogo</p><h2 className="mt-1 text-2xl font-bold text-[#2D2D2D]">Disponibilidad de instrumentos</h2><p className="mt-1 text-sm text-gray-600">Activo controla la visibilidad operativa; el licenciamiento controla si se pueden crear assessments.</p></div>
      {error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        {instruments.map((instrument) => (
          <div key={instrument.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-4 last:border-0">
            <div><p className="text-xs font-bold uppercase tracking-wide text-[#C0172C]">{instrument.code}</p><p className="font-semibold text-[#2D2D2D]">{instrument.name}</p></div>
            <div className="flex items-center gap-3"><span className="text-xs text-gray-500">Licencia: {LICENSE_STATUS_LABELS[instrument.licenseStatus] ?? instrument.licenseStatus}</span><button type="button" onClick={() => toggle(instrument)} disabled={isPending} className={`rounded-lg px-3 py-2 text-sm font-semibold disabled:opacity-60 ${instrument.isActive ? 'bg-green-50 text-green-800' : 'bg-gray-100 text-gray-700'}`}>{instrument.isActive ? 'Activo' : 'Inactivo'}</button></div>
          </div>
        ))}
      </div>
    </section>
  );
}
