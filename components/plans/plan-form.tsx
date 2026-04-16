'use client';

import { useRef, useState, useTransition } from 'react';
import { createPlan, type PlanType, type AthleteSummary } from '@/lib/plans/actions';

type Props = {
  type:     PlanType;
  athletes: AthleteSummary[];
  onSuccess?: () => void;
};

const TYPE_COLOR: Record<PlanType, { btn: string; focus: string }> = {
  medical:        { btn: 'bg-rose-600 hover:bg-rose-700',     focus: 'focus:ring-rose-500' },
  nutrition:      { btn: 'bg-emerald-600 hover:bg-emerald-700', focus: 'focus:ring-emerald-500' },
  psychology:     { btn: 'bg-purple-600 hover:bg-purple-700', focus: 'focus:ring-purple-500' },
  training:       { btn: 'bg-blue-600 hover:bg-blue-700',     focus: 'focus:ring-blue-500' },
  rehabilitation: { btn: 'bg-orange-600 hover:bg-orange-700', focus: 'focus:ring-orange-500' },
};

export function PlanForm({ type, athletes, onSuccess }: Props) {
  const formRef     = useRef<HTMLFormElement>(null);
  const [error, setError]     = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, start]    = useTransition();

  const [assignMode, setAssignMode]     = useState<'collective' | 'individual'>('collective');
  const [selectedIds, setSelectedIds]   = useState<string[]>([]);
  const [searchQ, setSearchQ]           = useState('');
  const [isPublished, setIsPublished]   = useState(false);
  const [notifyEmail, setNotifyEmail]   = useState(false);
  const [notifyPush, setNotifyPush]     = useState(false);

  const colors = TYPE_COLOR[type];

  const filtered = athletes.filter((a) =>
    `${a.first_name} ${a.last_name}`.toLowerCase().includes(searchQ.toLowerCase())
  );

  function toggleAthlete(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function handleSubmit(formData: FormData) {
    setError(null);
    setSuccess(false);

    // Inject controlled values that aren't raw form inputs
    formData.set('assignment_mode', assignMode);
    formData.set('is_published',    String(isPublished));
    formData.set('notify_email',    String(notifyEmail));
    formData.set('notify_push',     String(notifyPush));

    // Remove any stale athlete_ids entries and inject the current selection
    // (getAll is append-only, so we build manually)
    if (assignMode === 'individual') {
      selectedIds.forEach((id) => formData.append('athlete_ids', id));
    }

    start(async () => {
      const result = await createPlan(type, formData);
      if (result.error) {
        setError(result.error);
      } else {
        setSuccess(true);
        setSelectedIds([]);
        setAssignMode('collective');
        setIsPublished(false);
        setNotifyEmail(false);
        setNotifyPush(false);
        formRef.current?.reset();
        onSuccess?.();
      }
    });
  }

  return (
    <form ref={formRef} action={handleSubmit} className="space-y-5">

      {/* ── Success ─────────────────────────────────────────────────────── */}
      {success && (
        <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Plan creado exitosamente.
        </div>
      )}

      {/* ── Error ───────────────────────────────────────────────────────── */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* ── Title ───────────────────────────────────────────────────────── */}
      <div>
        <label className="block text-xs font-semibold text-gray-700 mb-1">
          Título <span className="text-red-500">*</span>
        </label>
        <input
          name="title"
          type="text"
          required
          placeholder="Ej. Plan de rehabilitación post-lesión rodilla"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>

      {/* ── Description ─────────────────────────────────────────────────── */}
      <div>
        <label className="block text-xs font-semibold text-gray-700 mb-1">
          Descripción (opcional)
        </label>
        <textarea
          name="description"
          rows={3}
          placeholder="Breve descripción del plan…"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm resize-none focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>

      {/* ── PDF File ────────────────────────────────────────────────────── */}
      <div>
        <label className="block text-xs font-semibold text-gray-700 mb-1">
          Archivo PDF (opcional)
        </label>
        <input
          name="file"
          type="file"
          accept="application/pdf,.pdf"
          className="block w-full text-sm text-gray-600
            file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0
            file:text-xs file:font-medium file:bg-indigo-50 file:text-indigo-700
            hover:file:bg-indigo-100 cursor-pointer"
        />
        <p className="mt-1 text-xs text-gray-400">Máximo 50 MB · Solo PDF</p>
      </div>

      {/* ── Notes ───────────────────────────────────────────────────────── */}
      <div>
        <label className="block text-xs font-semibold text-gray-700 mb-1">
          Notas internas (opcional)
        </label>
        <textarea
          name="notes"
          rows={2}
          placeholder="Notas internas que no verá el atleta…"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm resize-none focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>

      {/* ── Athlete assignment ───────────────────────────────────────────── */}
      <fieldset className="rounded-xl border border-gray-200 p-4 space-y-3">
        <legend className="text-xs font-semibold text-gray-700 px-1">
          Asignación de atletas
        </legend>

        {/* Mode toggle */}
        <div className="flex gap-3">
          {(['collective', 'individual'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => { setAssignMode(mode); setSelectedIds([]); }}
              className={`flex-1 rounded-lg border py-2 text-xs font-semibold transition-colors ${
                assignMode === mode
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'border-gray-300 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {mode === 'collective' ? '👥 Todos los atletas activos' : '🎯 Atletas específicos'}
            </button>
          ))}
        </div>

        {/* Individual selector */}
        {assignMode === 'individual' && (
          <div className="space-y-2">
            <input
              type="text"
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              placeholder="Buscar atleta…"
              className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            {athletes.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-3">No hay atletas activos.</p>
            ) : (
              <div className="max-h-44 overflow-y-auto rounded-lg border border-gray-200 divide-y divide-gray-100">
                {filtered.map((a) => (
                  <label
                    key={a.id}
                    className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      className="h-3.5 w-3.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      checked={selectedIds.includes(a.id)}
                      onChange={() => toggleAthlete(a.id)}
                    />
                    <span className="text-xs text-gray-700">
                      {a.last_name}, {a.first_name}
                    </span>
                  </label>
                ))}
                {filtered.length === 0 && (
                  <p className="text-xs text-gray-400 text-center py-3">Sin resultados.</p>
                )}
              </div>
            )}
            {selectedIds.length > 0 && (
              <p className="text-xs text-indigo-600 font-medium">
                {selectedIds.length} atleta{selectedIds.length !== 1 ? 's' : ''} seleccionado{selectedIds.length !== 1 ? 's' : ''}
              </p>
            )}
          </div>
        )}
      </fieldset>

      {/* ── Publish to mobile ────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 rounded-xl border border-gray-200 px-4 py-3">
        <label className="relative inline-flex cursor-pointer items-center">
          <input
            type="checkbox"
            className="sr-only peer"
            checked={isPublished}
            onChange={(e) => setIsPublished(e.target.checked)}
          />
          <div className="h-5 w-9 rounded-full bg-gray-200 peer-checked:bg-indigo-600 transition-colors peer-focus:ring-2 peer-focus:ring-indigo-300 after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all peer-checked:after:translate-x-4" />
        </label>
        <div>
          <p className="text-xs font-semibold text-gray-700">📱 Publicar en app móvil</p>
          <p className="text-xs text-gray-400">Los atletas asignados podrán ver este plan en la app.</p>
        </div>
      </div>

      {/* ── Notifications ────────────────────────────────────────────────── */}
      <fieldset className="rounded-xl border border-gray-200 p-4 space-y-2">
        <legend className="text-xs font-semibold text-gray-700 px-1">
          Notificar a los atletas
        </legend>
        <p className="text-xs text-gray-400">
          Se enviará al momento de crear el plan.
        </p>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            className="h-3.5 w-3.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            checked={notifyEmail}
            onChange={(e) => setNotifyEmail(e.target.checked)}
          />
          <span className="text-xs text-gray-700">📧 Notificar por correo electrónico</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            className="h-3.5 w-3.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            checked={notifyPush}
            onChange={(e) => setNotifyPush(e.target.checked)}
          />
          <span className="text-xs text-gray-700">📱 Notificar por push (app móvil)</span>
        </label>
      </fieldset>

      {/* ── Submit ──────────────────────────────────────────────────────── */}
      <button
        type="submit"
        disabled={isPending || (assignMode === 'individual' && selectedIds.length === 0)}
        className={`w-full rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-colors disabled:opacity-50 ${colors.btn}`}
      >
        {isPending ? 'Creando plan…' : '+ Crear plan'}
      </button>
    </form>
  );
}
