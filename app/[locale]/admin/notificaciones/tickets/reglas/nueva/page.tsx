'use client';

import { useRouter } from 'next/navigation';
import { useState }  from 'react';
import { createAutomationRule } from '../../actions';
import BackButton from '@/components/back-button';

const TRIGGER_EVENTS = [
  { value: 'ticket_created',          label: 'Ticket creado' },
  { value: 'ticket_assigned',         label: 'Ticket asignado' },
  { value: 'ticket_status_changed',   label: 'Estado cambiado' },
  { value: 'ticket_overdue',          label: 'Ticket vencido' },
  { value: 'ticket_pending_response', label: 'Sin respuesta' },
  { value: 'ticket_resolved',         label: 'Ticket resuelto' },
  { value: 'ticket_closed',           label: 'Ticket cerrado' },
];

const EVENT_KEY_OPTIONS = [
  'ticket_created', 'ticket_assigned', 'ticket_reassigned',
  'ticket_status_updated', 'ticket_pending_response',
  'ticket_follow_up', 'ticket_overdue', 'ticket_resolved', 'ticket_closed',
];

export default function NewAutomationRulePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true); setError(null);
    const fd = new FormData(e.currentTarget);
    fd.set('filter_statuses',   'null');
    fd.set('filter_priorities', 'null');
    fd.set('is_active',         'true');
    const res = await createAutomationRule(fd);
    setLoading(false);
    if (res.error) setError(res.error);
    else router.push('/admin/notificaciones/tickets');
  }

  return (
    <main className="p-8 max-w-2xl">
      <BackButton href="/admin/notificaciones/tickets/reglas" label="Volver a Reglas" />
      <h1 className="text-2xl font-bold text-amber-700 mt-4 mb-6">Nueva Regla de Automatización</h1>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nombre <span className="text-red-500">*</span></label>
          <input name="name" required className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
          <input name="description" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Plantilla de email (event_key) <span className="text-red-500">*</span></label>
          <select name="event_key" required className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none">
            <option value="">Selecciona…</option>
            {EVENT_KEY_OPTIONS.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Evento desencadenante <span className="text-red-500">*</span></label>
          <select name="trigger_event" required className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none">
            <option value="">Selecciona…</option>
            {TRIGGER_EVENTS.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Demora en minutos (0 = inmediato)</label>
          <input name="delay_minutes" type="number" min="0" defaultValue={0}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm w-40 focus:ring-2 focus:ring-amber-500 focus:outline-none" />
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 rounded p-3">{error}</p>}

        <div className="flex gap-3">
          <button type="submit" disabled={loading}
            className="rounded-md bg-amber-600 px-5 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50">
            {loading ? 'Guardando…' : 'Crear regla'}
          </button>
          <a href="/admin/notificaciones/tickets" className="rounded-md border border-gray-300 px-5 py-2 text-sm text-gray-700 hover:bg-gray-50">
            Cancelar
          </a>
        </div>
      </form>
    </main>
  );
}
