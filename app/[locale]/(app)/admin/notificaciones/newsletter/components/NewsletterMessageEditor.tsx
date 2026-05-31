'use client';

import { useState, useTransition } from 'react';

const MAX_BODY = 800;

export default function NewsletterMessageEditor({
  draftId,
  initialTitle,
  initialBody,
  onSaved,
}: {
  draftId:      string;
  initialTitle: string | null;
  initialBody:  string | null;
  onSaved:      (newHtml: string) => void;
}) {
  const [title,   setTitle]   = useState(initialTitle ?? '');
  const [body,    setBody]    = useState(initialBody  ?? '');
  const [isPending, startTransition] = useTransition();
  const [error,   setError]   = useState<string | null>(null);
  const [saved,   setSaved]   = useState(false);

  function handleSave() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const res = await fetch(`/api/newsletter/drafts/${draftId}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          custom_message_title: title.trim() || null,
          custom_message:       body.trim()  || null,
        }),
      });
      const data = await res.json() as { ok?: boolean; html_content?: string; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? 'Error al guardar');
      } else {
        setSaved(true);
        if (data.html_content) onSaved(data.html_content);
      }
    });
  }

  function handleClear() {
    setTitle('');
    setBody('');
    setError(null);
    setSaved(false);
    startTransition(async () => {
      await fetch(`/api/newsletter/drafts/${draftId}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ custom_message_title: null, custom_message: null }),
      }).then(r => r.json())
        .then((d: { html_content?: string }) => {
          if (d.html_content) onSaved(d.html_content);
        });
    });
  }

  const hasContent = body.trim().length > 0;

  return (
    <div className="space-y-4">
      {/* Description */}
      <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 flex gap-3">
        <span className="text-xl shrink-0">📢</span>
        <div>
          <p className="text-sm font-semibold text-blue-800 mb-0.5">Comunicado / Aviso especial</p>
          <p className="text-xs text-blue-600 leading-relaxed">
            Agrega un mensaje independiente de los tips: recordatorios de eventos, fechas importantes,
            convocatorias, avisos de plataforma, etc. Aparecerá destacado en el email después de los tips.
          </p>
        </div>
      </div>

      {/* Title (optional) */}
      <div>
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
          Título del aviso <span className="font-normal text-gray-400">(opcional)</span>
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => { setTitle(e.target.value); setSaved(false); }}
          placeholder="ej. Recordatorio de evaluación mensual"
          maxLength={80}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <p className="text-[11px] text-gray-400 mt-0.5 text-right">{title.length}/80</p>
      </div>

      {/* Body */}
      <div>
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
          Contenido del aviso <span className="text-red-400">*</span>
        </label>
        <textarea
          value={body}
          onChange={(e) => { setBody(e.target.value); setSaved(false); }}
          placeholder={
            '📅 Este viernes 6 de junio, evaluaciones de rendimiento en el gimnasio principal.\n\nRecuerda revisar tu calendario en la plataforma para confirmar tu horario de cita.'
          }
          rows={6}
          maxLength={MAX_BODY}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
        <p className={`text-[11px] mt-0.5 text-right ${body.length > MAX_BODY * 0.85 ? 'text-amber-600' : 'text-gray-400'}`}>
          {body.length}/{MAX_BODY}
        </p>
      </div>

      {/* Preview box */}
      {hasContent && (
        <div className="rounded-lg bg-blue-50 border-l-4 border-blue-500 p-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-blue-700 mb-1.5">
            📢 {title.trim() || 'Aviso'}
          </p>
          <p className="text-sm text-blue-900 whitespace-pre-line leading-relaxed">
            {body}
          </p>
          <p className="text-[10px] text-blue-400 mt-2 italic">Vista previa del bloque en el email</p>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={isPending || !hasContent}
          onClick={handleSave}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-50 transition-colors"
        >
          {isPending ? 'Guardando…' : 'Guardar comunicado'}
        </button>
        {hasContent && (
          <button
            type="button"
            disabled={isPending}
            onClick={handleClear}
            className="px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            Quitar aviso
          </button>
        )}
        {saved && (
          <span className="text-sm text-green-600">✓ Guardado en el email</span>
        )}
      </div>
    </div>
  );
}
