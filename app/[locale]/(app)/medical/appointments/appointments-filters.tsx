'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';

const MONTHS = [
  { value: '6',  label: 'Junio' },
  { value: '7',  label: 'Julio' },
  { value: '8',  label: 'Agosto' },
  { value: '9',  label: 'Septiembre' },
  { value: '10', label: 'Octubre' },
  { value: '11', label: 'Noviembre' },
  { value: '12', label: 'Diciembre' },
];

const SERVICES = [
  { value: 'all',          label: 'Todos los servicios' },
  { value: 'MÉDICO',       label: '🩺 Médico' },
  { value: 'FISIOTERAPIA', label: '🏃 Fisioterapia' },
  { value: 'NUTRICIÓN',    label: '🥗 Nutrición' },
  { value: 'PSICOLOGÍA',   label: '🧠 Psicología' },
];

const STATUSES = [
  { value: 'all',           label: 'Todos los estados' },
  { value: 'scheduled',     label: '🔵 Programada' },
  { value: 'show',          label: '✅ Atendida' },
  { value: 'no_show',       label: '❌ No asistió' },
  { value: 'no_show_remote',label: '📞 Llamada/Mensaje' },
  { value: 'rescheduled',   label: '🔄 Reagendada' },
];

export default function AppointmentsFilters({
  currentMonth,
  currentService,
  currentStatus,
  totalCount,
}: {
  currentMonth: string;
  currentService: string;
  currentStatus: string;
  totalCount: number;
}) {
  const router   = useRouter();
  const pathname = usePathname();
  const sp       = useSearchParams();

  const update = useCallback((key: string, value: string) => {
    const params = new URLSearchParams(sp.toString());
    if (value === 'all' || value === '') {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    router.push(`${pathname}?${params.toString()}`);
  }, [sp, router, pathname]);

  const selectClass =
    'rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent cursor-pointer';

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 mb-6">
      <div className="flex flex-wrap items-center gap-3">
        {/* Month */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Mes</label>
          <select
            value={currentMonth}
            onChange={(e) => update('month', e.target.value)}
            className={selectClass}
          >
            <option value="all">Todos los meses</option>
            {MONTHS.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>

        {/* Service */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Servicio</label>
          <select
            value={currentService}
            onChange={(e) => update('service', e.target.value)}
            className={selectClass}
          >
            {SERVICES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>

        {/* Status */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Estado</label>
          <select
            value={currentStatus}
            onChange={(e) => update('status', e.target.value)}
            className={selectClass}
          >
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>

        {/* Count + reset */}
        <div className="ml-auto flex items-end gap-2">
          <span className="text-sm text-gray-500">
            <span className="font-semibold text-gray-800">{totalCount}</span> citas
          </span>
          {(currentMonth !== 'all' || currentService !== 'all' || currentStatus !== 'all') && (
            <button
              type="button"
              onClick={() => router.push(pathname)}
              className="text-xs text-cyan-600 hover:text-cyan-800 hover:underline font-medium"
            >
              Limpiar filtros
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
