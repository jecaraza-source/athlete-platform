'use client';

import { useState } from 'react';
import { updateTicketEmailTemplate } from '../../actions';

type Template = {
  id: string; event_key: string; name: string; subject: string;
  html_body: string; plain_body: string; variables: string[]; is_active: boolean;
};

export default function EditTicketTemplateForm({ template }: { template: Template }) {
  const [tab, setTab]         = useState<'edit' | 'preview'>('edit');
  const [htmlBody, setHtml]   = useState(template.html_body);
  const [isActive, setActive] = useState(template.is_active);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved]     = useState(false);
  const [error, setError]     = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true); setSaved(false); setError(null);
    const fd = new FormData(e.currentTarget);
    fd.set('is_active', String(isActive));
    const res = await updateTicketEmailTemplate(template.id, fd);
    setLoading(false);
    if (res.error) setError(res.error);
    else setSaved(true);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Variables */}
      <div>
        <p className="block text-sm font-medium text-gray-700 mb-1">Variables disponibles</p>
        <div className="flex flex-wrap gap-1.5">
          {template.variables.map((v) => (
            <code key={v} className="rounded bg-amber-50 px-2 py-0.5 text-xs text-amber-700 font-mono">
              {`{{${v}}}`}
            </code>
          ))}
        </div>
      </div>

      {/* Subject */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Asunto <span className="text-red-500">*</span></label>
        <input name="subject" defaultValue={template.subject} required
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none" />
      </div>

      {/* HTML Body */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <label className="text-sm font-medium text-gray-700">Cuerpo HTML</label>
          <div className="flex rounded-md border border-gray-200 overflow-hidden text-xs">
            {(['edit', 'preview'] as const).map((t) => (
              <button key={t} type="button" onClick={() => setTab(t)}
                className={`px-3 py-1 ${tab === t ? 'bg-amber-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                {t === 'edit' ? 'Editor' : 'Vista previa'}
              </button>
            ))}
          </div>
        </div>
        {tab === 'edit' ? (
          <textarea name="html_body" value={htmlBody} onChange={(e) => setHtml(e.target.value)} required rows={12}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-amber-500 focus:outline-none" />
        ) : (
          <div className="rounded-md border border-gray-200 p-4 bg-white min-h-[200px]"
            dangerouslySetInnerHTML={{ __html: htmlBody }} />
        )}
      </div>

      {/* Plain text */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Cuerpo texto plano</label>
        <textarea name="plain_body" defaultValue={template.plain_body} rows={4}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-amber-500 focus:outline-none" />
      </div>

      {/* Active toggle */}
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-gray-700">Plantilla activa</label>
        <button type="button" onClick={() => setActive(!isActive)}
          className={`relative inline-flex h-6 w-11 rounded-full transition-colors ${isActive ? 'bg-amber-600' : 'bg-gray-200'}`}>
          <span className={`inline-block h-4 w-4 mt-1 rounded-full bg-white shadow transition-transform ${isActive ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
        <span className="text-xs text-gray-400">{isActive ? 'Se enviará automáticamente' : 'No se enviará'}</span>
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 rounded p-3">{error}</p>}
      {saved && <p className="text-sm text-green-700 bg-green-50 rounded p-3">Plantilla guardada.</p>}

      <button type="submit" disabled={loading}
        className="rounded-md bg-amber-600 px-5 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50">
        {loading ? 'Guardando…' : 'Guardar cambios'}
      </button>
    </form>
  );
}
