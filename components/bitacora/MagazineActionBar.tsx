'use client';
// =============================================================================
// MagazineActionBar
// Barra de acción fija en la parte inferior de la página de edición.
// Siempre muestra el ÚNICO botón más relevante según el paso actual del flujo.
// — Pasos con navegación (2, 4): botón que hace scroll suave a la sección.
// — Publicar (paso 3): llama a publishActivity() directamente.
// — Aprobar (paso 5): llama a approveNarrative() directamente.
// La barra se oculta cuando el flujo está completo (narrativa aprobada).
// =============================================================================

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { publishActivity, approveNarrative } from '@/lib/bitacora/actions';

// ── Props ────────────────────────────────────────────────────────────────────

interface Props {
  activityId:      string;
  narrativeId:     string | null;
  isPublished:     boolean;
  hasPhotos:       boolean;
  hasCover:        boolean;
  isEligible:      boolean;
  narrativeStatus: string | null;   // null | 'borrador' | 'aprobado' | 'rechazado'
  doneCount:       number;          // 1–6
}

// ── Action model ─────────────────────────────────────────────────────────────

type ActionKind = 'scroll' | 'publish' | 'approve';

interface BarAction {
  kind:     ActionKind;
  step:     string;
  label:    string;
  hint:     string;
  btnLabel: string;
  icon:     string;
  anchor?:  string;   // for scroll actions
  theme:    Theme;
}

type Theme = 'blue' | 'amber' | 'green' | 'red';

const THEME: Record<Theme, { bar: string; btn: string; icon: string; text: string }> = {
  blue:  { bar: 'bg-blue-50 border-blue-200',    btn: 'bg-blue-600 hover:bg-blue-700 text-white',    icon: 'bg-blue-100 text-blue-700',   text: 'text-blue-900'  },
  amber: { bar: 'bg-amber-50 border-amber-200',  btn: 'bg-amber-500 hover:bg-amber-600 text-white',  icon: 'bg-amber-100 text-amber-700', text: 'text-amber-900' },
  red:   { bar: 'bg-red-50 border-red-200',      btn: 'bg-red-600 hover:bg-red-700 text-white',      icon: 'bg-red-100 text-red-700',     text: 'text-red-900'   },
  green: { bar: 'bg-green-50 border-green-200',  btn: 'bg-green-600 hover:bg-green-700 text-white',  icon: 'bg-green-100 text-green-700', text: 'text-green-900' },
};

function computeBarAction(p: Props): BarAction | null {
  // ── Flujo completo — ocultar la barra ──────────────────────────────────────
  if (p.narrativeStatus === 'aprobado') return null;

  // ── Paso 2: fotos ─────────────────────────────────────────────────────────
  if (!p.hasPhotos) return {
    kind: 'scroll', step: 'Paso 2 de 6', icon: '📷',
    label:    'Sube fotos y marca la portada (★)',
    hint:     'La portada aparece como imagen hero en el artículo de la Revista.',
    btnLabel: 'Ir a Fotos ↓',
    anchor:   '#section-fotos',
    theme:    'blue',
  };

  if (!p.hasCover) return {
    kind: 'scroll', step: 'Paso 2 de 6', icon: '★',
    label:    'Marca una foto como portada (★)',
    hint:     'Pasa el cursor sobre una foto y pulsa "☆ Marcar portada".',
    btnLabel: 'Ir a Fotos ↓',
    anchor:   '#section-fotos',
    theme:    'blue',
  };

  // ── Paso 3: publicar ──────────────────────────────────────────────────────
  if (!p.isPublished) return {
    kind: 'publish', step: 'Paso 3 de 6', icon: '↑',
    label:    'Publicar la actividad',
    hint:     'Envía notificación push automáticamente.',
    btnLabel: '↑ Publicar ahora',
    theme:    'red',
  };

  // ── Paso 4 — elegibilidad ─────────────────────────────────────────────────
  if (!p.isEligible) return {
    kind: 'scroll', step: 'Paso 4 de 6', icon: '⚠',
    label:    'Activa "Elegible para Narrativa AI"',
    hint:     'El checkbox está en la sección Información.',
    btnLabel: 'Ir a Información ↑',
    anchor:   '#section-info',
    theme:    'amber',
  };

  // ── Paso 4 — narrativa rechazada ──────────────────────────────────────────
  if (p.narrativeStatus === 'rechazado') return {
    kind: 'scroll', step: 'Paso 4 de 6', icon: '↺',
    label:    'Regenerar narrativa AI',
    hint:     'La narrativa fue rechazada. Genera una nueva versión.',
    btnLabel: '↺ Regenerar ↓',
    anchor:   '#section-narrativa',
    theme:    'red',
  };

  // ── Paso 4 — sin narrativa ────────────────────────────────────────────────
  if (!p.narrativeStatus) return {
    kind: 'scroll', step: 'Paso 4 de 6', icon: '✦',
    label:    'Generar narrativa editorial AI',
    hint:     'El proceso tarda 10–30 segundos.',
    btnLabel: '✦ Generar narrativa ↓',
    anchor:   '#section-narrativa',
    theme:    'blue',
  };

  // ── Paso 5 — aprobar ──────────────────────────────────────────────────────
  if (p.narrativeStatus === 'borrador') return {
    kind: 'approve', step: 'Paso 5 de 6', icon: '✓',
    label:    'Aprobar narrativa para la Revista',
    hint:     'Publica el artículo en /revista inmediatamente.',
    btnLabel: '✓ Aprobar narrativa',
    theme:    'green',
  };

  return null;
}

// ── Component ────────────────────────────────────────────────────────────────

export function MagazineActionBar(props: Props) {
  const router = useRouter();
  const [loading,   setLoading]   = useState(false);
  const [success,   setSuccess]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  const action = computeBarAction(props);

  // Hide when done or dismissed
  if (!action || dismissed) return null;

  const t = THEME[action.theme];

  // ── Direct server action (publish / approve) ───────────────────────────────
  async function handleDirect() {
    setLoading(true);
    setError(null);

    let result: { error: string | null };

    if (action!.kind === 'publish') {
      result = await publishActivity(props.activityId, /* sendPush */ true);
    } else if (action!.kind === 'approve') {
      if (!props.narrativeId) { setLoading(false); return; }
      result = await approveNarrative(props.narrativeId);
    } else {
      setLoading(false);
      return;
    }

    setLoading(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    setSuccess(true);
    router.refresh();
    setTimeout(() => setSuccess(false), 2500);
  }

  // ── Smooth scroll ─────────────────────────────────────────────────────────
  function handleScroll(e: React.MouseEvent) {
    e.preventDefault();
    if (!action!.anchor) return;
    const el = document.querySelector(action!.anchor);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <div
      role="status"
      aria-label={`Acción requerida: ${action.label}`}
      className={`fixed bottom-0 inset-x-0 z-50 border-t shadow-lg print:hidden ${t.bar}`}
    >
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">

        {/* Step icon */}
        <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${t.icon}`}>
          {action.icon}
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <p className={`text-[10px] font-bold uppercase tracking-widest opacity-60 ${t.text}`}>
            {action.step}
          </p>
          <p className={`text-sm font-semibold leading-snug ${t.text}`}>
            {action.label}
          </p>
          {action.hint && (
            <p className={`text-xs hidden sm:block opacity-60 mt-0.5 ${t.text}`}>
              {action.hint}
            </p>
          )}
        </div>

        {/* Feedback */}
        {error && (
          <p className="text-xs text-red-600 font-medium max-w-[160px] text-right shrink-0 hidden sm:block">
            {error}
          </p>
        )}

        {/* Action button */}
        <div className="flex shrink-0 items-center gap-2 ml-auto">
          {action.kind === 'scroll' ? (
            <a
              href={action.anchor}
              onClick={handleScroll}
              className={`inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-lg transition-colors ${t.btn}`}
            >
              {action.btnLabel}
            </a>
          ) : (
            <button
              type="button"
              onClick={handleDirect}
              disabled={loading || success}
              className={`inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${t.btn}`}
            >
              {loading ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Procesando…
                </>
              ) : success ? (
                '✓ Listo'
              ) : (
                action.btnLabel
              )}
            </button>
          )}

          {/* Dismiss */}
          <button
            type="button"
            onClick={() => setDismissed(true)}
            aria-label="Cerrar barra de acciones"
            className={`p-1.5 rounded-lg transition-colors opacity-50 hover:opacity-100 ${t.text} hover:bg-black/5`}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
