'use client';

import { useState } from 'react';
import { updatePushTemplate } from './actions';

type Template = {
  id: string; name: string; description: string | null;
  title: string; message: string; deep_link: string | null;
  variables: string[]; status: string; version: number;
};

export default function EditPushTemplateForm({ template }: { template: Template }) {
  const [status, setStatus] = useState(template.status);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved]     = useState(false);
  const [error, setError]     = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true); setSaved(false); setError(null);
    const fd = new FormData(e.currentTarget);
    fd.set('variables', JSON.stringify(template.variables));
    const res = await updatePushTemplate(template.id, fd);
    setLoading(false);
    if (res.error) setError(res.error);
    else setSaved(true);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Name */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
        <input name="name" defaultValue={template.name} required
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500 focus:outline-none" />
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
        <input name="description" defaultValue={template.description ?? ''}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500 focus:outline-none" />
      </div>

      {/* Title */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Título <span className="text-red-500">*</span></label>
        <input name="title" defaultValue={template.title} required
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500 focus:outline-none" />
      </div>

      {/* Message */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Mensaje <span className="text-red-500">*</span></label>
        <textarea name="message" defaultValue={template.message} required rows={3}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500 focus:outline-none" />
      </div>

      {/* Deep link */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Deep link</label>
        <input name="deep_link" defaultValue={template.deep_link ?? ''}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500 focus:outline-none"
          placeholder="athlete-platform://calendar" />
      </div>

      {/* Variables */}
      {template.variables.length > 0 && (
        <div>
          <p className="block text-sm font-medium text-gray-700 mb-1">Variables disponibles</p>
          <div className="flex flex-wrap gap-1.5">
            {template.variables.map((v) => (
              <code key={v} className="rounded bg-violet-50 px-2 py-0.5 text-xs text-violet-700 font-mono">
                {`{{${v}}}`}
              </code>
            ))}
          </div>
        </div>
      )}

      {/* Status */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
        <select name="status" value={status} onChange={(e) => setStatus(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm">
          <option value="draft">Borrador</option>
          <option value="active">Activa</option>
          <option value="archived">Archivada</option>
        </select>
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 rounded p-3">{error}</p>}
      {saved && <p className="text-sm text-green-700 bg-green-50 rounded p-3">Plantilla guardada.</p>}

      <button type="submit" disabled={loading}
        className="rounded-md bg-violet-600 px-5 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50">
        {loading ? 'Guardando…' : 'Guardar cambios'}
      </button>
    </form>
  );
}
