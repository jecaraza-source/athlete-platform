'use client';

import { useState, useTransition } from 'react';
import type { Tip }                 from '@/lib/newsletter/types';

export default function NewsletterTipEditor({
  draftId,
  initialTips,
  onSaved,
}: {
  draftId:     string;
  initialTips: Tip[];
  onSaved:     (newHtml: string) => void;
}) {
  const [tips, setTips]          = useState<Tip[]>(initialTips);
  const [isPending, startTransition] = useTransition();
  const [error, setError]        = useState<string | null>(null);
  const [saved, setSaved]        = useState(false);

  function updateTip(index: number, field: keyof Tip, value: string) {
    setTips((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
    setSaved(false);
  }

  function handleSave() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const res = await fetch(`/api/newsletter/drafts/${draftId}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ tips }),
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

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        Edita los 3 tips del newsletter. Los cambios regeneran el HTML del email automáticamente.
      </p>

      {tips.map((tip, i) => (
        <div key={i} className="rounded-lg border border-gray-200 p-4 space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
            <span className="text-base">{tip.emoji}</span>
            <span>Tip {i + 1}</span>
          </div>

          {/* Row: emoji + categoria */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Emoji</label>
              <input
                type="text"
                value={tip.emoji}
                onChange={(e) => updateTip(i, 'emoji', e.target.value)}
                maxLength={4}
                className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Categoría (máx. 20 chars)</label>
              <input
                type="text"
                value={tip.categoria}
                onChange={(e) => updateTip(i, 'categoria', e.target.value)}
                maxLength={20}
                className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          {/* Título */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Título (máx. 60 chars)</label>
            <input
              type="text"
              value={tip.titulo}
              onChange={(e) => updateTip(i, 'titulo', e.target.value)}
              maxLength={60}
              className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          {/* Contenido */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Contenido (máx. 300 chars)</label>
            <textarea
              value={tip.contenido}
              onChange={(e) => updateTip(i, 'contenido', e.target.value)}
              maxLength={300}
              rows={3}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
            />
            <p className="text-[11px] text-gray-400 mt-0.5 text-right">
              {tip.contenido.length}/300
            </p>
          </div>
        </div>
      ))}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={isPending}
          onClick={handleSave}
          className="px-4 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-md disabled:opacity-50 transition-colors"
        >
          {isPending ? 'Guardando…' : 'Guardar cambios'}
        </button>
        {saved && (
          <span className="text-sm text-green-600">✓ Cambios guardados</span>
        )}
      </div>
    </div>
  );
}
