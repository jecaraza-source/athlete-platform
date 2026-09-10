'use client';

import { useState, useTransition } from 'react';
import { saveInstrumentLicenseCheck } from '@/app/[locale]/(app)/dashboard/mental-health/actions';

type LicenseStatus = 'pending_review' | 'licensed' | 'not_required' | 'denied';

type Check = {
  permissionType: string;
  label: string;
  status: LicenseStatus;
  notes: string;
  verifiedBy: string | null;
  verifiedAt: string | null;
};

type Instrument = {
  id: string;
  code: string;
  name: string;
  licenseStatus: LicenseStatus;
  checks: Check[];
};

type Props = {
  instruments: Instrument[];
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

export function LicenseStatusManager({ instruments }: Props) {
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function save(instrumentId: string, check: Check, form: HTMLFormElement) {
    const data = new FormData(form);
    const status = String(data.get('status')) as LicenseStatus;
    const notes = String(data.get('notes') ?? '');
    const key = `${instrumentId}:${check.permissionType}`;
    setPendingKey(key);

    startTransition(async () => {
      const result = await saveInstrumentLicenseCheck({
        instrumentId,
        permissionType: check.permissionType,
        status,
        notes,
      });
      setError(result.error ?? null);
      setPendingKey(null);
    });
  }

  return (
    <div className="space-y-6">
      {error && <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
      {instruments.map((instrument) => (
        <section key={instrument.id} className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#C0172C]">{instrument.code}</p>
              <h2 className="mt-1 font-bold text-[#2D2D2D]">{instrument.name}</h2>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${STATUS_STYLES[instrument.licenseStatus]}`}>
              {STATUS_LABELS[instrument.licenseStatus]}
            </span>
          </header>
          <div className="divide-y divide-gray-100">
            {instrument.checks.map((check) => {
              const key = `${instrument.id}:${check.permissionType}`;
              return (
                <form
                  key={check.permissionType}
                  onSubmit={(event) => {
                    event.preventDefault();
                    save(instrument.id, check, event.currentTarget);
                  }}
                  className="grid gap-3 px-5 py-4 lg:grid-cols-[minmax(190px,1fr)_180px_minmax(240px,2fr)_auto]"
                >
                  <div>
                    <p className="text-sm font-semibold text-[#2D2D2D]">{check.label}</p>
                    <p className="mt-1 text-xs text-gray-500">
                      {check.verifiedBy && check.verifiedAt
                        ? `Verificado por ${check.verifiedBy} el ${new Date(check.verifiedAt).toLocaleDateString('es-MX')}`
                        : 'Aún sin verificación registrada'}
                    </p>
                  </div>
                  <select
                    name="status"
                    defaultValue={check.status}
                    className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-[#C0172C] focus:outline-none focus:ring-2 focus:ring-red-100"
                  >
                    {Object.entries(STATUS_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                  <textarea
                    name="notes"
                    defaultValue={check.notes}
                    rows={2}
                    placeholder="Notas, enlace a licencia o alcance de la autorización…"
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:border-[#C0172C] focus:outline-none focus:ring-2 focus:ring-red-100"
                  />
                  <button
                    type="submit"
                    disabled={isPending && pendingKey === key}
                    className="self-start rounded-lg border border-[#C0172C] px-3 py-2 text-sm font-semibold text-[#C0172C] transition hover:bg-red-50 disabled:opacity-60"
                  >
                    {isPending && pendingKey === key ? 'Guardando…' : 'Guardar'}
                  </button>
                </form>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
