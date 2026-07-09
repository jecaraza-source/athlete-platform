'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { Activity, ActivityType } from '@/lib/types/bitacora';
import {
  createActivity, updateActivity, publishActivity,
  unpublishActivity, deleteActivity,
} from '@/lib/bitacora/actions';

// ── Listas predefinidas para dropdowns ─────────────────────────────────────
const DISCIPLINAS = [
  'Taekwondo','Atletismo','Natación','Boxeo','Lucha','Judo',
  'Karate','Gimnasia','Ciclismo','Fútbol','Basquetbol','Voleibol',
  'Tenis','Halterofilia','Tiro','Esgrima','Pentatlón Moderno','Otro',
];

const ESPECIALIDADES: Record<string, string[]> = {
  Taekwondo:  ['Combate','Poomsae','Kyorugi','Para-Taekwondo'],
  Atletismo:  ['Velocidad','Fondo','Saltos','Lanzamientos','Marcha','Decatlón'],
  Natación:   ['Libre','Espalda','Pecho','Mariposa','Combinado','Aguas Abiertas'],
  Boxeo:      ['Olímpico','Profesional'],
  Lucha:      ['Libre','Grecorromana','Femenil'],
  default:    ['Técnica','Fuerza','Resistencia','Coordinación','Táctica','Otro'],
};

const ACTIVIDADES_TIPO = [
  'Competencia','Torneo','Copa','Campeonato','Liga','Amistoso',
  'Entrenamiento','Concentración','Preparación física','Evaluación',
  'Capacitación','Exhibición','Semillero','Selección','Otro',
];

const SEDES = [
  'Instalaciones AO Deporte','Centro de Alto Rendimiento','Estadio Nacional',
  'Unidad Deportiva','Gimnasio Municipal','Alberca Olímpica',
  'Pista de Atletismo','Sede Internacional','Otra sede',
];

// ── Helpers ─────────────────────────────────────────────────────────────────
function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="text-sm font-medium text-gray-700">
      {children}{required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
  );
}
function Field({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-1">{children}</div>;
}
function Select({ value, onChange, options, placeholder }: {
  value: string; onChange: (v: string) => void;
  options: string[]; placeholder?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-400"
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}
function TextInput({ value, onChange, placeholder, maxLength }: {
  value: string; onChange: (v: string) => void;
  placeholder?: string; maxLength?: number;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      maxLength={maxLength}
      className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
    />
  );
}
function TextArea({ value, onChange, placeholder, rows = 3, maxLength }: {
  value: string; onChange: (v: string) => void;
  placeholder?: string; rows?: number; maxLength?: number;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      maxLength={maxLength}
      className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
    />
  );
}

// ── Componente principal ─────────────────────────────────────────────────────
interface ActivityAdminFormProps {
  activity?: Activity;
  locale:    string;
}

export function ActivityAdminForm({ activity, locale }: ActivityAdminFormProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  // Clasificación
  const [type,          setType]          = useState<ActivityType>(activity?.type ?? 'evento_deportivo');
  const [disciplina,    setDisciplina]    = useState(activity?.disciplina    ?? '');
  const [especialidad,  setEspecialidad]  = useState(activity?.especialidad  ?? '');
  const [actividadTipo, setActividadTipo] = useState(activity?.actividad_tipo ?? '');

  // Datos del evento
  const [title,       setTitle]       = useState(activity?.title       ?? '');
  const [description, setDescription] = useState(activity?.description ?? '');
  const [eventDate,   setEventDate]   = useState(activity?.event_date  ?? '');
  const [horario,     setHorario]     = useState(activity?.horario     ?? '');
  const [sede,        setSede]        = useState(activity?.sede        ?? '');
  const [location,    setLocation]    = useState(activity?.location    ?? '');

  // Planificación
  const [objetivo,             setObjetivo]             = useState(activity?.objetivo             ?? '');
  const [requerimiento,        setRequerimiento]        = useState(activity?.requerimiento        ?? '');
  const [numParticipantes,     setNumParticipantes]     = useState(String(activity?.numero_participantes ?? ''));
  const [personalRequerido,    setPersonalRequerido]    = useState(activity?.personal_requerido   ?? '');
  const [equipoRequerido,      setEquipoRequerido]      = useState(activity?.equipo_requerido     ?? '');

  // Tags y config
  const [tagInput,    setTagInput]    = useState((activity?.tags ?? []).join(', '));
  const [editorialEl, setEditorialEl] = useState(activity?.editorial_eligible ?? true);
  const [sendPush,    setSendPush]    = useState(true);

  // Atención Operativa
  const [atencionActividad, setAtencionActividad] = useState(activity?.atencion_actividad ?? '');
  const [atencionFecha,     setAtencionFecha]     = useState(activity?.atencion_fecha     ?? '');

  // UI state
  const [error,  setError]  = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const isNew       = !activity;
  const isPublished = activity?.status === 'publicado';

  function parseTags(raw: string): string[] {
    return raw.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean);
  }

  function buildInput() {
    return {
      type,
      title:                title.trim(),
      description:          description.trim() || undefined,
      event_date:           eventDate || undefined,
      location:             location.trim() || undefined,
      tags:                 parseTags(tagInput),
      editorial_eligible:   editorialEl,
      disciplina:           disciplina  || undefined,
      especialidad:         especialidad  || undefined,
      actividad_tipo:       actividadTipo || undefined,
      sede:                 sede || undefined,
      horario:              horario || undefined,
      requerimiento:        requerimiento.trim() || undefined,
      numero_participantes: numParticipantes ? Number(numParticipantes) : undefined,
      personal_requerido:   personalRequerido.trim() || undefined,
      equipo_requerido:     equipoRequerido.trim() || undefined,
      objetivo:             objetivo.trim() || undefined,
      atencion_actividad:   atencionActividad.trim() || undefined,
      atencion_fecha:       atencionFecha || undefined,
    };
  }

  async function handleSave() {
    if (!title.trim()) { setError('El título es requerido.'); return; }
    setSaving(true);
    setError(null);
    const result = isNew
      ? await createActivity(buildInput())
      : await updateActivity(activity.id, buildInput());
    setSaving(false);
    if (result.error) { setError(result.error); return; }
    if (isNew && result.data) router.push(`/${locale}/admin/bitacora/${result.data.id}/editar`);
  }

  async function handlePublish() {
    if (!activity) return;
    setSaving(true); setError(null);
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

  const especialidadesOptions = disciplina
    ? (ESPECIALIDADES[disciplina] ?? ESPECIALIDADES.default)
    : ESPECIALIDADES.default;

  return (
    <div className="flex flex-col gap-6">

      {/* ── Sección 1: Tipo y clasificación ─────────────────────────────── */}
      <section className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col gap-4">
        <h3 className="font-semibold text-gray-800 text-sm uppercase tracking-wide text-gray-500">
          Clasificación
        </h3>

        {/* Tipo */}
        <Field>
          <Label required>Tipo de actividad</Label>
          <div className="flex gap-4">
            {(['evento_deportivo', 'consulta'] as ActivityType[]).map((t) => (
              <label key={t} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio" name="type" value={t} checked={type === t}
                  onChange={() => {
                    setType(t);
                    if (t === 'consulta') setEditorialEl(false);
                    else setEditorialEl(true);
                  }}
                  className="accent-red-600"
                />
                <span className="text-sm">{t === 'evento_deportivo' ? 'Evento deportivo' : 'Consulta'}</span>
              </label>
            ))}
          </div>
        </Field>

        <div className="grid sm:grid-cols-3 gap-3">
          <Field>
            <Label>Disciplina</Label>
            <Select
              value={disciplina}
              onChange={(v) => { setDisciplina(v); setEspecialidad(''); }}
              options={DISCIPLINAS}
              placeholder="Seleccionar…"
            />
          </Field>
          <Field>
            <Label>Especialidad</Label>
            <Select
              value={especialidad}
              onChange={setEspecialidad}
              options={especialidadesOptions}
              placeholder="Seleccionar…"
            />
          </Field>
          <Field>
            <Label>Actividad</Label>
            <Select
              value={actividadTipo}
              onChange={setActividadTipo}
              options={ACTIVIDADES_TIPO}
              placeholder="Seleccionar…"
            />
          </Field>
        </div>
      </section>

      {/* ── Sección 2: Datos del evento ──────────────────────────────────── */}
      <section className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col gap-4">
        <h3 className="font-semibold text-gray-800 text-sm uppercase tracking-wide text-gray-500">
          Datos del evento
        </h3>

        <Field>
          <Label required>Título</Label>
          <TextInput
            value={title} onChange={setTitle}
            placeholder="ej. Torneo Nacional de Taekwondo 2026"
            maxLength={200}
          />
        </Field>

        <Field>
          <Label>Descripción <span className="text-gray-400 text-xs">(~300 caracteres)</span></Label>
          <TextArea
            value={description} onChange={setDescription}
            placeholder="Descripción breve del evento…"
            rows={3} maxLength={400}
          />
          <span className="text-xs text-gray-400 text-right">{description.length}/400</span>
        </Field>

        <div className="grid sm:grid-cols-2 gap-3">
          <Field>
            <Label>Fecha</Label>
            <input
              type="date" value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
            />
          </Field>
          <Field>
            <Label>Horario</Label>
            <input
              type="time" value={horario}
              onChange={(e) => setHorario(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
            />
          </Field>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <Field>
            <Label>Sede</Label>
            <Select
              value={sede} onChange={setSede}
              options={SEDES} placeholder="Seleccionar sede…"
            />
          </Field>
          <Field>
            <Label>Lugar / Dirección</Label>
            <TextInput
              value={location} onChange={setLocation}
              placeholder="ej. Ciudad de México, CDMX"
              maxLength={200}
            />
          </Field>
        </div>
      </section>

      {/* ── Sección 3: Planificación ─────────────────────────────────────── */}
      <section className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col gap-4">
        <h3 className="font-semibold text-gray-800 text-sm uppercase tracking-wide text-gray-500">
          Planificación
        </h3>

        <Field>
          <Label>Objetivo</Label>
          <TextArea value={objetivo} onChange={setObjetivo}
            placeholder="Describe el objetivo principal de esta actividad…" rows={3}
          />
        </Field>

        <Field>
          <Label>Requerimiento</Label>
          <TextArea value={requerimiento} onChange={setRequerimiento}
            placeholder="Requisitos previos, condiciones necesarias…" rows={2}
          />
        </Field>

        <div className="grid sm:grid-cols-3 gap-3">
          <Field>
            <Label>N.º de participantes</Label>
            <input
              type="number" min={0} value={numParticipantes}
              onChange={(e) => setNumParticipantes(e.target.value)}
              placeholder="0"
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
            />
          </Field>
          <Field>
            <Label>Personal requerido</Label>
            <TextInput value={personalRequerido} onChange={setPersonalRequerido}
              placeholder="ej. 2 árbitros, 1 médico"
            />
          </Field>
          <Field>
            <Label>Equipo requerido</Label>
            <TextInput value={equipoRequerido} onChange={setEquipoRequerido}
              placeholder="ej. Tatami, protecciones"
            />
          </Field>
        </div>
      </section>

      {/* ── Sección 4: Tags y configuración ──────────────────────────────── */}
      <section className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col gap-4">
        <h3 className="font-semibold text-gray-800 text-sm uppercase tracking-wide text-gray-500">
          Tags y configuración
        </h3>

        <Field>
          <Label>Tags</Label>
          <TextInput value={tagInput} onChange={setTagInput}
            placeholder="taekwondo, competencia, nacional (separados por coma)"
          />
        </Field>

        <div className="flex items-start gap-3 bg-amber-50 border border-amber-100 rounded-lg p-3">
          <input
            type="checkbox" id="editorial-eligible"
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
                ? '⚠ Las consultas están excluidas por defecto para proteger datos de salud.'
                : 'Los eventos deportivos son elegibles por defecto.'}
            </p>
          </div>
        </div>
      </section>

      {/* ── Sección 5: Atención Operativa ────────────────────────────────── */}
      <section className="bg-blue-50 border border-blue-200 rounded-xl p-5 flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <span className="text-blue-600 text-lg">📋</span>
          <h3 className="font-semibold text-blue-800 text-sm uppercase tracking-wide">
            Atención Operativa
          </h3>
          <span className="text-xs text-blue-500 bg-blue-100 px-2 py-0.5 rounded-full">Interno</span>
        </div>
        <p className="text-xs text-blue-600">
          Esta sección es solo para uso interno del staff. No se muestra públicamente.
        </p>

        <div className="grid sm:grid-cols-2 gap-3">
          <Field>
            <Label>Actividad</Label>
            <TextInput
              value={atencionActividad} onChange={setAtencionActividad}
              placeholder="Describe la atención operativa requerida…"
            />
          </Field>
          <Field>
            <Label>Fecha</Label>
            <input
              type="date" value={atencionFecha}
              onChange={(e) => setAtencionFecha(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
            />
          </Field>
        </div>
      </section>

      {/* ── Error ─────────────────────────────────────────────────────────── */}
      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          {error}
        </p>
      )}

      {/* ── Acciones ──────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3 items-center">
        <button
          type="button" onClick={handleSave} disabled={saving}
          className="bg-gray-900 hover:bg-gray-800 disabled:bg-gray-300 text-white font-semibold px-5 py-2 rounded-lg text-sm transition-colors"
        >
          {saving ? 'Guardando…' : isNew ? 'Crear actividad' : 'Guardar cambios'}
        </button>

        {!isNew && !isPublished && (
          <>
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input type="checkbox" checked={sendPush} onChange={(e) => setSendPush(e.target.checked)} className="accent-red-600" />
              Enviar notificación push
            </label>
            <button
              type="button" onClick={handlePublish} disabled={saving}
              className="bg-red-600 hover:bg-red-700 disabled:bg-gray-300 text-white font-semibold px-5 py-2 rounded-lg text-sm transition-colors"
            >
              {saving ? 'Publicando…' : '↑ Publicar'}
            </button>
          </>>
        )}

        {!isNew && isPublished && (
          <button
            type="button" onClick={handleUnpublish} disabled={saving}
            className="border border-amber-300 text-amber-700 hover:bg-amber-50 disabled:opacity-50 font-medium px-4 py-2 rounded-lg text-sm transition-colors"
          >
            ↓ Despublicar
          </button>
        )}

        {!isNew && (
          <button
            type="button" onClick={handleDelete} disabled={saving}
            className="ml-auto border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50 font-medium px-4 py-2 rounded-lg text-sm transition-colors"
          >
            Eliminar actividad
          </button>
        )}
      </div>
    </div>
  );
}
