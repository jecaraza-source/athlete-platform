'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { Activity, ActivityType } from '@/lib/types/bitacora';
import { createActivity, updateActivity, publishActivity, unpublishActivity, deleteActivity } from '@/lib/bitacora/actions';

interface ActivityAdminFormProps {
  activity?: Activity;
  locale:    string;
}

export function ActivityAdminForm({ activity, locale }: ActivityAdminFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [title,       setTitle]       = useState(activity?.title       ?? '');
  const [type,        setType]        = useState<ActivityType>(activity?.type ?? 'evento_deportivo');
  const [description, setDescription] = useState(activity?.description ?? '');
  const [eventDate,   setEventDate]   = useState(activity?.event_date   ?? '');
  const [location,    setLocation]    = useState(activity?.location     ?? '');
  const [tagInput,    setTagInput]    = useState((activity?.tags ?? []).join(', '));
  const [editorialEl, setEditorialEl] = useState(activity?.editorial_eligible ?? true);
  const [sendPush,    setSendPush]    = useState(true);
  const [error,       setError]       = useState<string | null>(null);
  const [saving,      setSaving]      = useState(false);

  const isNew = !activity;

  function parseTags(raw: string): string[] {
    return raw.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean);
  }

  async function handleSave() {
    if (!title.trim()) { setError('El título es requerido.'); return; }
    setSaving(true);
    setError(null);

    const input = {
      type,
      title:              title.trim(),
      description:        description.trim() || undefined,
      event_date:         eventDate || undefined,
      location:           location.trim() || undefined,
      tags:               parseTags(tagInput),
      editorial_eligible: editorialEl,
    };

    const result = isNew
      ? await createActivity(input)
      : await updateActivity(activity.id, input);

    setSaving(false);

    if (result.error) { setError(result.error); return; }

    if (isNew && result.data) {
      router.push(`/${locale}/admin/bitacora/${result.data.id}/editar`);
    }
  }

  async function handlePublish() {
    if (!activity) return;
    setSaving(true);
    setError(null);
    const result = await publishActivity(activity.id, sendPush);
    setSaving(false);
    if (result.error) { setError(result.error); return; }
    router.refresh();
  }

  async function handleUnpublish() {
    if (!activity) return;
    setSaving(true);
    const result = await unpublishActivity(activity.id);
    setSaving(false);
    if (result.error) setError(result.error);
    else router.refresh();
  }

  async function handleDelete() {
    if (!activity || !confirm('¿Eliminar esta actividad? Se eliminarán también sus fotos. No se puede deshacer.')) return;
    setSaving(true);
    const result = await deleteActivity(activity.id);
    setSaving(false);
    if (result.error) { setError(result.error); return; }
    router.push(`/${locale}/admin/bitacora`);
  }

  const isPublished = activity?.status === 'publicado';

  return (
    <div className="flex flex-col gap-6">
      {/* Datos básicos */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col gap-4">
        <h3 className="font-semibold text-gray-800">Información de la actividad</h3>

        {/* Tipo */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">Tipo *</label>
          <div className="flex gap-3">
            {(['evento_deportivo', 'consulta'] as ActivityType[]).map((t) => (
              <label key={t} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="type"
                  value={t}
                  checked={type === t}
                  onChange={() => {
                    setType(t);
                    if (t === 'consulta') setEditorialEl(false);
                    else setEditorialEl(true);
                  }}
                  className="accent-red-600"
                />
                <span className="text-sm">
                  {t === 'evento_deportivo' ? 'Evento deportivo' : 'Consulta'}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Título */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">Título *</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
            placeholder="ej. Torneo Nacional de Taekwondo 2026"
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
          />
        </div>

        {/* Descripción */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">
            Descripción <span className="text-gray-400 text-xs">(~300 caracteres)</span>
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            maxLength={400}
            placeholder="Descripción breve del evento…"
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
          />
          <span className="text-xs text-gray-400 text-right">{description.length}/400</span>
        </div>

        {/* Fecha y lugar */}
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Fecha del evento</label>
            <input
              type="date"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Lugar</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              maxLength={200}
              placeholder="ej. Estadio Olímpico, CDMX"
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
            />
          </div>
        </div>

        {/* Tags */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">Tags</label>
          <input
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            placeholder="taekwondo, competencia, nacional (separados por coma)"
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
          />
        </div>

        {/* Editorial eligible */}
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-100 rounded-lg p-3">
          <input
            type="checkbox"
            id="editorial-eligible"
            checked={editorialEl}
            onChange={(e) => setEditorialEl(e.target.checked)}
            className="mt-0.5 accent-red-600"
          />
          <div className="flex flex-col gap-0.5">
            <label htmlFor="editorial-eligible" className="text-sm font-medium text-gray-800 cursor-pointer">
              Elegible para Narrativa AI y Revista
            </label>
            <p className="text-xs text-gray-500">
              {type === 'consulta'
                ? '⚠ Las consultas están excluidas por defecto para proteger datos de salud. Solo activa esta opción si el contenido es apto para publicación editorial.'
                : 'Los eventos deportivos son elegibles por defecto.'}
            </p>
          </div>
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          {error}
        </p>
      )}

      {/* Acciones */}
      <div className="flex flex-wrap gap-3 items-center">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="bg-gray-900 hover:bg-gray-800 disabled:bg-gray-300 text-white font-semibold px-5 py-2 rounded-lg text-sm transition-colors"
        >
          {saving ? 'Guardando…' : isNew ? 'Crear actividad' : 'Guardar cambios'}
        </button>

        {!isNew && !isPublished && (
          <>
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input
                type="checkbox"
                checked={sendPush}
                onChange={(e) => setSendPush(e.target.checked)}
                className="accent-red-600"
              />
              Enviar notificación push
            </label>
            <button
              type="button"
              onClick={handlePublish}
              disabled={saving}
              className="bg-red-600 hover:bg-red-700 disabled:bg-gray-300 text-white font-semibold px-5 py-2 rounded-lg text-sm transition-colors"
            >
              {saving ? 'Publicando…' : '↑ Publicar'}
            </button>
          </>
        )}

        {!isNew && isPublished && (
          <button
            type="button"
            onClick={handleUnpublish}
            disabled={saving}
            className="border border-amber-300 text-amber-700 hover:bg-amber-50 disabled:opacity-50 font-medium px-4 py-2 rounded-lg text-sm transition-colors"
          >
            ↓ Despublicar
          </button>
        )}

        {!isNew && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={saving}
            className="ml-auto border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50 font-medium px-4 py-2 rounded-lg text-sm transition-colors"
          >
            Eliminar actividad
          </button>
        )}
      </div>
    </div>
  );
}
