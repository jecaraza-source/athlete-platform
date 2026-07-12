'use client';

import { useRouter }  from 'next/navigation';
import { useState }   from 'react';
import { createEmailTemplate } from '../../actions';
import BackButton from '@/components/back-button';

export default function NewEmailTemplatePage() {
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
    const res = await createEmailTemplate(fd);
    setLoading(false);
    if (res.error) setError(res.error);
    else router.push('/admin/notificaciones/email/plantillas');
  }

  return (
    <main className="p-8 max-w-3xl">
      <BackButton href="/admin/notificaciones/email/plantillas" label="Volver a Plantillas" />
      <h1 className="text-2xl font-bold text-rose-700 mt-4 mb-6">Nueva Plantilla de Email</h1>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nombre <span className="text-red-500">*</span></label>
          <input name="name" required className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-rose-500 focus:outline-none" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
          <input name="description" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-rose-500 focus:outline-none" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Asunto <span className="text-red-500">*</span></label>
          <input name="subject" required className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-rose-500 focus:outline-none"
            placeholder="Ej: Recordatorio para {{first_name}}" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Variables (separadas por comas)</label>
          <input name="variables_raw" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-rose-500 focus:outline-none"
            placeholder="first_name, last_name, event_date" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Cuerpo HTML <span className="text-red-500">*</span></label>
          <textarea name="html_body" required rows={10}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-rose-500 focus:outline-none"
            placeholder="<p>Hola {{first_name}},</p>" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Cuerpo texto plano</label>
          <textarea name="plain_body" rows={4}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-rose-500 focus:outline-none" />
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
            className="rounded-md bg-rose-600 px-5 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50">
            {loading ? 'Guardando…' : 'Crear plantilla'}
          </button>
          <a href="/admin/notificaciones/email/plantillas"
            className="rounded-md border border-gray-300 px-5 py-2 text-sm text-gray-700 hover:bg-gray-50">
            Cancelar
          </a>
        </div>
      </form>
    </main>
  );
}
