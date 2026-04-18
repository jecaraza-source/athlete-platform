'use client';

import { useState } from 'react';
import { updateEmailTemplate } from '../../actions';

type Template = {
  id: string; name: string; description: string | null; subject: string;
  html_body: string; plain_body: string; variables: string[]; status: string;
};

export default function EditEmailTemplateForm({ template }: { template: Template }) {
  const [tab, setTab]         = useState<'edit' | 'preview'>('edit');
  const [htmlBody, setHtml]   = useState(template.html_body);
  const [subject, setSubject] = useState(template.subject);
  const [status, setStatus]   = useState(template.status);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved]     = useState(false);
  const [error, setError]     = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true); setSaved(false); setError(null);
    const fd = new FormData(e.currentTarget);
    const res = await updateEmailTemplate(template.id, fd);
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
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-rose-500 focus:outline-none" />
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
        <input name="description" defaultValue={template.description ?? ''}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-rose-500 focus:outline-none" />
      </div>

      {/* Subject */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Asunto</label>
        <input name="subject" value={subject} onChange={(e) => setSubject(e.target.value)} required
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-rose-500 focus:outline-none" />
      </div>

      {/* Variables */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Variables disponibles</label>
        <div className="flex flex-wrap gap-1.5">
          {template.variables.map((v) => (
            <code key={v} className="rounded bg-rose-50 px-2 py-0.5 text-xs text-rose-700 font-mono">
              {`{{${v}}}`}
            </code>
          ))}
        </div>
        <input type="hidden" name="variables" value={JSON.stringify(template.variables)} />
      </div>

      {/* HTML Body with preview tab */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <label className="text-sm font-medium text-gray-700">Cuerpo HTML</label>
          <div className="flex rounded-md border border-gray-200 overflow-hidden text-xs">
            {(['edit', 'preview'] as const).map((t) => (
              <button key={t} type="button" onClick={() => setTab(t)}
                className={`px-3 py-1 ${tab === t ? 'bg-rose-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                {t === 'edit' ? 'Editor' : 'Vista previa'}
              </button>
            ))}
          </div>
        </div>

        {tab === 'edit' ? (
          <textarea name="html_body" value={htmlBody} onChange={(e) => setHtml(e.target.value)} required
            rows={12}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-rose-500 focus:outline-none" />
        ) : (
          <div className="rounded-md border border-gray-200 p-4 bg-white min-h-[200px]"
            dangerouslySetInnerHTML={{ __html: htmlBody }} />
        )}
      </div>

      {/* Plain text body */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Cuerpo texto plano</label>
        <textarea name="plain_body" defaultValue={template.plain_body} rows={4}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-rose-500 focus:outline-none" />
      </div>

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

      {error  && <p className="text-sm text-red-600 bg-red-50 rounded p-3">{error}</p>}
      {saved  && <p className="text-sm text-green-700 bg-green-50 rounded p-3">Plantilla guardada correctamente.</p>}

      <button type="submit" disabled={loading}
        className="rounded-md bg-rose-600 px-5 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50">
        {loading ? 'Guardando…' : 'Guardar cambios'}
      </button>
    </form>
  );
}
