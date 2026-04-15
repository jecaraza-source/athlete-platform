'use client';

import { useRouter }  from 'next/navigation';
import { useState }   from 'react';
import { createEmailCampaign } from '../actions';

type Template = { id: string; name: string; subject: string };
type Profile  = { id: string; first_name: string; last_name: string; email: string | null; role: string | null };

export default function NewEmailCampaignForm({
  templates,
  profiles,
}: {
  templates: Template[];
  profiles:  Profile[];
}) {
  const router = useRouter();
  const [selectionMode, setSelectionMode] = useState<'individual' | 'collective'>('collective');
  const [audienceType, setAudienceType]   = useState<'athlete' | 'staff' | 'mixed'>('athlete');
  const [selectedIds, setSelectedIds]     = useState<string[]>([]);
  const [error, setError]                 = useState<string | null>(null);
  const [loading, setLoading]             = useState(false);

  const athletes = profiles.filter((p) => p.role === 'athlete');
  const staff    = profiles.filter((p) => p.role !== 'athlete');

  function toggleRecipient(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const fd = new FormData(e.currentTarget);
    fd.set('selection_mode', selectionMode);
    fd.set('audience_type', audienceType);
    fd.set('recipient_ids', JSON.stringify(selectedIds));
    fd.set('audience_filters', '{}');
    fd.set('variable_overrides', '{}');

    const res = await createEmailCampaign(fd);
    setLoading(false);

    if (res.error) {
      setError(res.error);
    } else {
      router.push('/admin/notificaciones/email');
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Name */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Nombre de la campaña <span className="text-red-500">*</span>
        </label>
        <input
          name="name"
          required
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
          placeholder="Ej: Recordatorio entrenamiento semana 12"
        />
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
        <textarea
          name="description"
          rows={2}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
        />
      </div>

      {/* Template */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Plantilla <span className="text-red-500">*</span>
        </label>
        {templates.length === 0 ? (
          <p className="text-sm text-gray-400 italic">
            No hay plantillas activas. Crea una en{' '}
            <a href="/admin/notificaciones/email/plantillas" className="text-rose-600 underline">Plantillas</a>.
          </p>
        ) : (
          <select
            name="template_id"
            required
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
          >
            <option value="">Selecciona una plantilla…</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        )}
      </div>

      {/* Selection mode */}
      <div>
        <p className="block text-sm font-medium text-gray-700 mb-2">Modo de selección</p>
        <div className="flex gap-4">
          {(['collective', 'individual'] as const).map((mode) => (
            <label key={mode} className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="radio"
                name="selection_mode"
                value={mode}
                checked={selectionMode === mode}
                onChange={() => setSelectionMode(mode)}
              />
              {mode === 'collective' ? 'Colectivo' : 'Individual'}
            </label>
          ))}
        </div>
      </div>

      {/* Audience type (collective) */}
      {selectionMode === 'collective' && (
        <div>
          <p className="block text-sm font-medium text-gray-700 mb-2">Tipo de audiencia</p>
          <div className="flex gap-4">
            {(['athlete', 'staff', 'mixed'] as const).map((t) => (
              <label key={t} className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="radio"
                  name="audience_type"
                  value={t}
                  checked={audienceType === t}
                  onChange={() => setAudienceType(t)}
                />
                {t === 'athlete' ? 'Atletas' : t === 'staff' ? 'Staff' : 'Mixto'}
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Individual recipient selection */}
      {selectionMode === 'individual' && (
        <div>
          <p className="block text-sm font-medium text-gray-700 mb-2">
            Selecciona destinatarios ({selectedIds.length} seleccionados)
          </p>
          <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-md divide-y">
            {profiles.map((p) => (
              <label key={p.id} className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer text-sm">
                <input
                  type="checkbox"
                  checked={selectedIds.includes(p.id)}
                  onChange={() => toggleRecipient(p.id)}
                />
                <span className="flex-1">
                  {p.first_name} {p.last_name}
                  {p.email && <span className="text-gray-400 ml-1">({p.email})</span>}
                </span>
                <span className="text-xs text-gray-400">{p.role}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Schedule */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Programar envío (dejar vacío para enviar ahora)
        </label>
        <input
          type="datetime-local"
          name="scheduled_at"
          className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
        />
      </div>

      {/* Timezone */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Zona horaria</label>
        <select
          name="timezone"
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="UTC">UTC</option>
          <option value="America/Mexico_City">América/Ciudad de México</option>
          <option value="America/New_York">América/Nueva York</option>
          <option value="Europe/Madrid">Europa/Madrid</option>
        </select>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded p-3">{error}</p>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-rose-600 px-5 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50"
        >
          {loading ? 'Guardando…' : 'Crear campaña'}
        </button>
        <a
          href="/admin/notificaciones/email"
          className="rounded-md border border-gray-300 px-5 py-2 text-sm text-gray-700 hover:bg-gray-50"
        >
          Cancelar
        </a>
      </div>
    </form>
  );
}
