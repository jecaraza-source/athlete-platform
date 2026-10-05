'use client';

import { useMemo, useState, useTransition } from 'react';
import { updatePsychAlert } from '@/app/[locale]/(app)/dashboard/mental-health/actions';

type Alert = {
  id: string;
  athleteName: string;
  alertType: string;
  severity: 'low' | 'medium' | 'high';
  status: 'open' | 'acknowledged' | 'resolved';
  notes: string;
  createdAt: string;
};

export function PsychAlertsManager({ alerts }: { alerts: Alert[] }) {
  const [statusFilter, setStatusFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const filteredAlerts = useMemo(() => alerts.filter((alert) =>
    (statusFilter === 'all' || alert.status === statusFilter) &&
    (severityFilter === 'all' || alert.severity === severityFilter)
  ), [alerts, severityFilter, statusFilter]);

  function update(alert: Alert, form: HTMLFormElement) {
    const status = String(new FormData(form).get('status')) as 'acknowledged' | 'resolved';
    const notes = String(new FormData(form).get('notes') ?? '');
    startTransition(async () => {
      const result = await updatePsychAlert({ alertId: alert.id, status, notes });
      setError(result.error ?? null);
    });
  }

  return (
    <section className="mt-10">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#C0172C]">Seguimiento</p><h2 className="mt-1 text-2xl font-bold text-[#2D2D2D]">Alertas psicológicas</h2></div>
        <div className="flex gap-2">
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm"><option value="all">Todos los estados</option><option value="open">Abiertas</option><option value="acknowledged">Reconocidas</option><option value="resolved">Resueltas</option></select>
          <select value={severityFilter} onChange={(event) => setSeverityFilter(event.target.value)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm"><option value="all">Todas las severidades</option><option value="high">Alta</option><option value="medium">Media</option><option value="low">Baja</option></select>
        </div>
      </div>
      {error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        {filteredAlerts.length === 0 ? <p className="px-6 py-8 text-sm text-gray-500">No hay alertas para los filtros seleccionados.</p> : filteredAlerts.map((alert) => (
          <form key={alert.id} onSubmit={(event) => { event.preventDefault(); update(alert, event.currentTarget); }} className="grid gap-3 border-b border-gray-100 px-5 py-4 last:border-0 lg:grid-cols-[minmax(190px,1fr)_150px_minmax(220px,2fr)_auto]">
            <div><p className="font-semibold text-[#2D2D2D]">{alert.athleteName}</p><p className="text-sm text-gray-600">{alert.alertType.replaceAll('_', ' ')}</p><p className="mt-1 text-xs text-gray-400">{new Date(alert.createdAt).toLocaleDateString('es-MX')}</p></div>
            <span className={`self-start rounded-full px-3 py-1 text-xs font-bold ${alert.severity === 'high' ? 'bg-red-50 text-red-800' : alert.severity === 'medium' ? 'bg-amber-50 text-amber-800' : 'bg-sky-50 text-sky-800'}`}>{alert.severity}</span>
            <div className="space-y-2"><select name="status" defaultValue={alert.status === 'open' ? 'acknowledged' : alert.status} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"><option value="acknowledged">Reconocer</option><option value="resolved">Resolver</option></select><textarea name="notes" defaultValue={alert.notes} rows={2} placeholder="Notas de seguimiento…" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" /></div>
            <button type="submit" disabled={isPending} className="self-start rounded-lg border border-[#C0172C] px-3 py-2 text-sm font-semibold text-[#C0172C] hover:bg-red-50 disabled:opacity-60">{isPending ? 'Guardando…' : 'Guardar'}</button>
          </form>
        ))}
      </div>
    </section>
  );
}
