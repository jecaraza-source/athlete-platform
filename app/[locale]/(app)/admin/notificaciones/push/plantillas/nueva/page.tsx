'use client';

import { useRouter } from 'next/navigation';
import { useState }  from 'react';
import { createPushTemplate } from '../../actions';
import BackButton from '@/components/back-button';

export default function NewPushTemplatePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true); setError(null);
    const fd = new FormData(e.currentTarget);
    fd.set('variables', JSON.stringify(
      (fd.get('variables_raw') as string || '').split(',').map((v) => v.trim()).filter(Boolean)
    ));
    const res = await createPushTemplate(fd);
    setLoading(false);
    if (res.error) setError(res.error);
    else router.push('/admin/notificaciones/push/plantillas');
  }

  return (
    <main className="p-8 max-w-2xl">
      <BackButton href="/admin/notificaciones/push/plantillas" label="Volver a Plantillas" />
      <h1 className="text-2xl font-bold text-violet-700 mt-4 mb-6">Nueva Plantilla Push</h1>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nombre <span className="text-red-500">*</span></label>
          <input name="name" required className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500 focus:outline-none" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
          <input name="description" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500 focus:outline-none" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Título <span className="text-red-500">*</span></label>
          <input name="title" required className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500 focus:outline-none"
            placeholder="Ej: Recordatorio de entrenamiento 💪" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Mensaje <span className="text-red-500">*</span></label>
          <textarea name="message" required rows={3} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500 focus:outline-none"
            placeholder="Hola {{first_name}}, tienes entrenamiento hoy." />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Deep link (opcional)</label>
          <input name="deep_link" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500 focus:outline-none"
            placeholder="athlete-platform://calendar" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Variables (separadas por comas)</label>
          <input name="variables_raw" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500 focus:outline-none"
            placeholder="first_name, event_name" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
          <select name="status" className="rounded-md border border-gray-300 px-3 py-2 text-sm">
            <option value="draft">Borrador</option>
            <option value="active">Activa</option>
          </select>
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 rounded p-3">{error}</p>}

        <div className="flex gap-3">
          <button type="submit" disabled={loading}
            className="rounded-md bg-violet-600 px-5 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50">
            {loading ? 'Guardando…' : 'Crear plantilla'}
          </button>
          <a href="/admin/notificaciones/push/plantillas" className="rounded-md border border-gray-300 px-5 py-2 text-sm text-gray-700 hover:bg-gray-50">
            Cancelar
          </a>
        </div>
      </form>
    </main>
  );
}
