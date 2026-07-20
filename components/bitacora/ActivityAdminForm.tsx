'use client';

import { useState, useTransition, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import type { Activity, ActivityAthlete, ActivityType } from '@/lib/types/bitacora';
import {
  createActivity, updateActivity, publishActivity,
  unpublishActivity, deleteActivity, setActivityAthletes,
} from '@/lib/bitacora/actions';

// ── Listas predefinidas para dropdowns ─────────────────────────────────────
// Disciplinas en el mismo orden que cat_disciplines (011_initial_diagnostic.sql)
const DISCIPLINAS = [
  'Judo',
  'Karate',
  'Tae Kwon Do',
  'Atletismo',
  'Natación',
  'Canotaje',
  'Parabadminton',
  'Tiro con Arco',
  'Tiro Deportivo',
  'Gimnasia Artística Femenil',
  'Breaking',
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

// ── Tipos para el selector de atletas ───────────────────────────────────────
export interface AthleteOption {
  id:           string;
  athlete_code: string | null;
  first_name:   string;
  last_name:    string;
  discipline:   string | null;
}

// ── Componente principal ─────────────────────────────────────────────────────
interface ActivityAdminFormProps {
  activity?:        Activity;
  locale:           string;
  /** Lista completa de atletas disponibles para seleccionar como beneficiarios */
  allAthletes?:     AthleteOption[];
  /** Atletas ya vinculados a esta actividad (para edición) */
  linkedAthletes?:  ActivityAthlete[];
}

export function ActivityAdminForm({ activity, locale, allAthletes = [], linkedAthletes = [] }: ActivityAdminFormProps) {
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
  const [atencionActividad,   setAtencionActividad]   = useState(activity?.atencion_actividad    ?? '');
  const [atencionFecha,       setAtencionFecha]       = useState(activity?.atencion_fecha        ?? '');
  const [atencionEntregadoA,  setAtencionEntregadoA]  = useState(activity?.atencion_entregado_a  ?? '');
  const [atencionEntregadoRol,setAtencionEntregadoRol]= useState(activity?.atencion_entregado_rol ?? '');

  // Beneficiarios (activity_athletes)
  const [selectedAthleteIds, setSelectedAthleteIds] = useState<string[]>(
    linkedAthletes.map((a) => a.athlete_id)
  );
  const [athleteSearch, setAthleteSearch] = useState('');

  // UI state
  const [error,  setError]  = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const isNew       = !activity;
  const isPublished = activity?.status === 'publicado';

  function parseTags(raw: string): string[] {
    return raw.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean);
  }

  // Atletas filtrados por búsqueda
  const filteredAthletes = useMemo(() => {
    const q = athleteSearch.toLowerCase().trim();
    if (!q) return allAthletes;
    return allAthletes.filter((a) =>
      `${a.first_name} ${a.last_name} ${a.athlete_code ?? ''} ${a.discipline ?? ''}`
        .toLowerCase().includes(q)
    );
  }, [allAthletes, athleteSearch]);

  function toggleAthlete(id: string) {
    setSelectedAthleteIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function buildInput() {
    return {
      type,
      title:                  title.trim(),
      description:            description.trim() || undefined,
      event_date:             eventDate || undefined,
      location:               location.trim() || undefined,
      tags:                   parseTags(tagInput),
      editorial_eligible:     editorialEl,
      disciplina:             disciplina    || undefined,
      especialidad:           especialidad  || undefined,
      actividad_tipo:         actividadTipo || undefined,
      sede:                   sede          || undefined,
      horario:                horario       || undefined,
      requerimiento:          requerimiento.trim()      || undefined,
      numero_participantes:   numParticipantes ? Number(numParticipantes) : undefined,
      personal_requerido:     personalRequerido.trim()  || undefined,
      equipo_requerido:       equipoRequerido.trim()    || undefined,
      objetivo:               objetivo.trim()           || undefined,
      atencion_actividad:     atencionActividad.trim()  || undefined,
      atencion_fecha:         atencionFecha             || undefined,
      atencion_entregado_a:   atencionEntregadoA.trim() || undefined,
      atencion_entregado_rol: atencionEntregadoRol.trim() || undefined,
    };
  }

  async function handleSave() {
    if (!title.trim()) { setError('El título es requerido.'); return; }
    setSaving(true);
    setError(null);

    if (isNew) {
      const result = await createActivity({ ...buildInput(), athlete_ids: selectedAthleteIds });
      setSaving(false);
      if (result.error) { setError(result.error); return; }
      if (result.data) router.push(`/${locale}/admin/bitacora/${result.data.id}/editar`);
    } else {
      const [actResult, athleteResult] = await Promise.all([
        updateActivity(activity.id, buildInput()),
        setActivityAthletes(activity.id, selectedAthleteIds),
      ]);
      setSaving(false);
      if (actResult.error)    { setError(actResult.error);    return; }
      if (athleteResult.error){ setError(athleteResult.error); return; }
      router.refresh();
    }
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

        <div className="grid sm:grid-cols-2 gap-3">
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
            <TextInput
              value={especialidad}
              onChange={setEspecialidad}
              placeholder="ej. Poomsae, Sprint, Kata…"
            />
          </Field>
        </div>
        <Field>
          <Label>Actividad</Label>
          <TextArea
            value={actividadTipo}
            onChange={setActividadTipo}
            placeholder="Describe la actividad…"
            rows={4}
            maxLength={500}
          />
          <span className="text-xs text-gray-400 text-right">{actividadTipo.length}/500</span>
        </Field>
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

      {/* ── Sección 5: Atención Operativa ──────────────────────────────────── */}
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

        {/* Qué se entregó y fecha */}
        <div className="grid sm:grid-cols-2 gap-3">
          <Field>
            <Label>Descripción de la atención</Label>
            <TextInput
              value={atencionActividad} onChange={setAtencionActividad}
              placeholder="ej. 6 botes de Gatorade en polvo 2.38 kg…"
            />
          </Field>
          <Field>
            <Label>Fecha de entrega</Label>
            <input
              type="date" value={atencionFecha}
              onChange={(e) => setAtencionFecha(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
            />
          </Field>
        </div>

        {/* A quién se entregó */}
        <div className="grid sm:grid-cols-2 gap-3">
          <Field>
            <Label>Entregado a</Label>
            <TextInput
              value={atencionEntregadoA} onChange={setAtencionEntregadoA}
              placeholder="Nombre completo de quien recibió el apoyo"
            />
          </Field>
          <Field>
            <Label>Cargo / Rol</Label>
            <TextInput
              value={atencionEntregadoRol} onChange={setAtencionEntregadoRol}
              placeholder="ej. Entrenador de atletismo, Médico del equipo"
            />
          </Field>
        </div>
      </section>

      {/* ── Sección 6: Beneficiarios (activity_athletes) ──────────────── */}
      {allAthletes.length > 0 && (
        <section className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-gray-500 text-lg">🏅</span>
              <h3 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">
                Atletas Beneficiarios
              </h3>
            </div>
            <span className="text-xs font-semibold bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
              {selectedAthleteIds.length} seleccionado{selectedAthleteIds.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Chips de seleccionados */}
          {selectedAthleteIds.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {selectedAthleteIds.map((aid) => {
                const a = allAthletes.find((x) => x.id === aid);
                if (!a) return null;
                return (
                  <span
                    key={aid}
                    className="inline-flex items-center gap-1 bg-red-50 border border-red-200 text-red-700 text-xs font-medium px-2 py-1 rounded-full"
                  >
                    <span>{a.athlete_code ? `${a.athlete_code} — ` : ''}{a.first_name} {a.last_name}</span>
                    <button
                      type="button"
                      onClick={() => toggleAthlete(aid)}
                      className="ml-0.5 hover:text-red-900 transition-colors"
                      aria-label="Quitar"
                    >
                      ×
                    </button>
                  </span>
                );
              })}
            </div>
          )}

          {/* Buscador */}
          <input
            type="text"
            value={athleteSearch}
            onChange={(e) => setAthleteSearch(e.target.value)}
            placeholder="Buscar por nombre, folio o disciplina…"
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
          />

          {/* Lista de atletas */}
          <div className="max-h-56 overflow-y-auto border border-gray-100 rounded-lg divide-y divide-gray-50">
            {filteredAthletes.length === 0 ? (
              <p className="text-xs text-gray-400 p-3 text-center">Sin resultados</p>
            ) : (
              filteredAthletes.map((a) => {
                const selected = selectedAthleteIds.includes(a.id);
                return (
                  <label
                    key={a.id}
                    className={`flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors text-sm ${
                      selected ? 'bg-red-50' : 'hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => toggleAthlete(a.id)}
                      className="accent-red-600 shrink-0"
                    />
                    <span className="flex-1 min-w-0">
                      <span className="font-medium text-gray-800">{a.first_name} {a.last_name}</span>
                      {a.athlete_code && (
                        <span className="ml-2 text-xs text-gray-400">{a.athlete_code}</span>
                      )}
                    </span>
                    {a.discipline && (
                      <span className="text-xs text-gray-400 shrink-0 capitalize">{a.discipline.replace('_', ' ')}</span>
                    )}
                  </label>
                );
              })
            )}
          </div>
        </section>
      )}

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
          </>
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
