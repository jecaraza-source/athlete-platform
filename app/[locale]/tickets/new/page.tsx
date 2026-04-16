'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter }                         from 'next/navigation';
import { createMyTicket }                    from '../actions';
import BackButton                            from '@/components/back-button';

const PRIORITY_OPTIONS = [
  { value: 'low',    label: 'Baja — cosmético o inconveniencia menor' },
  { value: 'medium', label: 'Media — afecta mi flujo de trabajo' },
  { value: 'high',   label: 'Alta — bloquea una función importante' },
  { value: 'urgent', label: 'Urgente — requiere atención inmediata' },
];

export default function NewTicketPage() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);

  const [error, setError]   = useState<string | null>(null);
  const [isPending, start]  = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    start(async () => {
      const result = await createMyTicket(formData);
      if (result.error) {
        setError(result.error);
      } else {
        router.push(result.ticketId ? `/tickets/${result.ticketId}` : '/tickets');
      }
    });
  }

  return (
    <main className="p-8 max-w-2xl">
      <BackButton href="/tickets" label="Volver a Mis Tickets" />

      <h1 className="text-2xl font-bold text-teal-700 mt-4 mb-2">Nuevo Ticket</h1>
      <p className="text-sm text-gray-500 mb-8">
        Describe tu solicitud o reporte y el equipo técnico lo atenderá a la brevedad.
      </p>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        {error && (
          <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <form ref={formRef} action={handleSubmit} className="space-y-5">

          {/* Título */}
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
              Título <span className="text-red-500">*</span>
            </label>
            <input
              id="title"
              name="title"
              type="text"
              required
              placeholder="Describe brevemente el problema o solicitud"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
            />
          </div>

          {/* Descripción */}
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
              Descripción <span className="text-gray-400 font-normal">(opcional)</span>
            </label>
            <textarea
              id="description"
              name="description"
              rows={5}
              placeholder="Detalla lo que ocurrió, cuándo sucedió, qué esperabas que pasara…"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm resize-y focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
            />
          </div>

          {/* Prioridad */}
          <div>
            <label htmlFor="priority" className="block text-sm font-medium text-gray-700 mb-1">
              Prioridad
            </label>
            <select
              id="priority"
              name="priority"
              defaultValue="medium"
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
            >
              {PRIORITY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* Acciones */}
          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={isPending}
              className="rounded-lg bg-teal-600 px-5 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50 transition-colors"
            >
              {isPending ? 'Enviando…' : 'Enviar ticket'}
            </button>
            <button
              type="button"
              onClick={() => router.back()}
              className="rounded-lg border border-gray-300 px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
          </div>

        </form>
      </div>
    </main>
  );
}
