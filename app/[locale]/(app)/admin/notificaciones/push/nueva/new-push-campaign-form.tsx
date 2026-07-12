'use client';

import { useRouter } from 'next/navigation';
import { useState }  from 'react';
import { createPushCampaign } from '../actions';

type Template = { id: string; name: string; title: string };
type Profile  = { id: string; first_name: string; last_name: string; email: string | null; role: string | null };

export default function NewPushCampaignForm({ templates, profiles }: { templates: Template[]; profiles: Profile[] }) {
  const router = useRouter();
  const [selectionMode, setSelectionMode] = useState<'individual' | 'collective'>('collective');
  const [audienceType, setAudienceType]   = useState<'athlete' | 'staff' | 'mixed'>('athlete');
  const [selectedIds, setSelectedIds]     = useState<string[]>([]);
  const [loading, setLoading]             = useState(false);
  const [error, setError]                 = useState<string | null>(null);

  function toggleRecipient(id: string) {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true); setError(null);
    const fd = new FormData(e.currentTarget);
    fd.set('selection_mode', selectionMode);
    fd.set('audience_type', audienceType);
    fd.set('recipient_ids', JSON.stringify(selectedIds));
    fd.set('audience_filters', '{}');
    fd.set('variable_overrides', '{}');
    const res = await createPushCampaign(fd);
    setLoading(false);
    if (res.error) setError(res.error);
    else router.push('/admin/notificaciones/push');
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Nombre <span className="text-red-500">*</span></label>
        <input name="name" required className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500 focus:outline-none" />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
        <textarea name="description" rows={2} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500 focus:outline-none" />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Plantilla <span className="text-red-500">*</span></label>
        {templates.length === 0 ? (
          <p className="text-sm text-gray-400 italic">
            No hay plantillas push activas.{' '}
            <a href="/admin/notificaciones/push/plantillas" className="text-violet-600 underline">Crear una</a>.
          </p>
        ) : (
          <select name="template_id" required className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500 focus:outline-none">
            <option value="">Selecciona una plantilla…</option>
            {templates.map((t) => <option key={t.id} value={t.id}>{t.name} — {t.title}</option>)}
          </select>
        )}
      </div>

      <div>
        <p className="block text-sm font-medium text-gray-700 mb-2">Modo de selección</p>
        <div className="flex gap-4">
          {(['collective', 'individual'] as const).map((m) => (
            <label key={m} className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="radio" checked={selectionMode === m} onChange={() => setSelectionMode(m)} />
              {m === 'collective' ? 'Colectivo' : 'Individual'}
            </label>
          ))}
        </div>
      </div>

      {selectionMode === 'collective' && (
        <div>
          <p className="block text-sm font-medium text-gray-700 mb-2">Audiencia</p>
          <div className="flex gap-4">
            {(['athlete', 'staff', 'mixed'] as const).map((t) => (
              <label key={t} className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="radio" checked={audienceType === t} onChange={() => setAudienceType(t)} />
                {t === 'athlete' ? 'Atletas' : t === 'staff' ? 'Staff' : 'Mixto'}
              </label>
            ))}
          </div>
        </div>
      )}

      {selectionMode === 'individual' && (
        <div>
          <p className="block text-sm font-medium text-gray-700 mb-2">Destinatarios ({selectedIds.length})</p>
          <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-md divide-y">
            {profiles.map((p) => (
              <label key={p.id} className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer text-sm">
                <input type="checkbox" checked={selectedIds.includes(p.id)} onChange={() => toggleRecipient(p.id)} />
                <span className="flex-1">{p.first_name} {p.last_name}</span>
                <span className="text-xs text-gray-400">{p.role}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Programar envío</label>
        <input type="datetime-local" name="scheduled_at" className="rounded-md border border-gray-300 px-3 py-2 text-sm" />
      </div>

      <input type="hidden" name="timezone" value="UTC" />
      <input type="hidden" name="recurrence" value="none" />

      {error && <p className="text-sm text-red-600 bg-red-50 rounded p-3">{error}</p>}

      <div className="flex gap-3">
        <button type="submit" disabled={loading}
          className="rounded-md bg-violet-600 px-5 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50">
          {loading ? 'Guardando…' : 'Crear campaña'}
        </button>
        <a href="/admin/notificaciones/push" className="rounded-md border border-gray-300 px-5 py-2 text-sm text-gray-700 hover:bg-gray-50">
          Cancelar
        </a>
      </div>
    </form>
  );
}
