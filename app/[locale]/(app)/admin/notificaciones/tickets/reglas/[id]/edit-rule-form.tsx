'use client';

import { useState } from 'react';
import { updateAutomationRule } from '../../actions';

const TRIGGER_EVENTS = [
  { value: 'ticket_created',          label: 'Ticket creado' },
  { value: 'ticket_assigned',         label: 'Ticket asignado' },
  { value: 'ticket_status_changed',   label: 'Estado cambiado' },
  { value: 'ticket_overdue',          label: 'Ticket vencido' },
  { value: 'ticket_pending_response', label: 'Sin respuesta' },
  { value: 'ticket_resolved',         label: 'Ticket resuelto' },
  { value: 'ticket_closed',           label: 'Ticket cerrado' },
];

type Rule = {
  id: string; name: string; description: string | null; event_key: string;
  trigger_event: string; delay_minutes: number; is_active: boolean;
  filter_statuses: string[] | null; filter_priorities: string[] | null;
};

export default function EditRuleForm({ rule }: { rule: Rule }) {
  const [isActive, setIsActive] = useState(rule.is_active);
  const [loading, setLoading]   = useState(false);
  const [saved, setSaved]       = useState(false);
  const [error, setError]       = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true); setSaved(false); setError(null);
    const fd = new FormData(e.currentTarget);
    fd.set('filter_statuses',   JSON.stringify(rule.filter_statuses ?? null));
    fd.set('filter_priorities', JSON.stringify(rule.filter_priorities ?? null));
    fd.set('is_active',         String(isActive));
    const res = await updateAutomationRule(rule.id, fd);
    setLoading(false);
    if (res.error) setError(res.error);
    else setSaved(true);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Nombre <span className="text-red-500">*</span></label>
        <input name="name" defaultValue={rule.name} required
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
        <input name="description" defaultValue={rule.description ?? ''}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Plantilla de email (event_key)</label>
        <input name="event_key" defaultValue={rule.event_key} required
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-amber-500 focus:outline-none" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Evento desencadenante</label>
        <select name="trigger_event" defaultValue={rule.trigger_event} required
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none">
          {TRIGGER_EVENTS.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Demora en minutos</label>
        <input name="delay_minutes" type="number" min="0" defaultValue={rule.delay_minutes}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm w-40 focus:ring-2 focus:ring-amber-500 focus:outline-none" />
      </div>
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-gray-700">Regla activa</label>
        <button type="button" onClick={() => setIsActive(!isActive)}
          className={`relative inline-flex h-6 w-11 rounded-full transition-colors ${isActive ? 'bg-amber-600' : 'bg-gray-200'}`}>
          <span className={`inline-block h-4 w-4 mt-1 rounded-full bg-white shadow transition-transform ${isActive ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 rounded p-3">{error}</p>}
      {saved && <p className="text-sm text-green-700 bg-green-50 rounded p-3">Regla actualizada.</p>}

      <button type="submit" disabled={loading}
        className="rounded-md bg-amber-600 px-5 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50">
        {loading ? 'Guardando…' : 'Guardar cambios'}
      </button>
    </form>
  );
}
