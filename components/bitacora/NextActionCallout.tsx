// =============================================================================
// NextActionCallout
// Server Component — muestra el siguiente paso requerido en el flujo editorial.
// Aparece justo debajo del BitacoraPublishStepper en la página de edición.
// Los href son anclas a las secciones de la misma página (#section-*).
// =============================================================================

import type { ActivityWithRelations } from '@/lib/types/bitacora';

interface Props {
  activity: ActivityWithRelations;
}

type Variant = 'info' | 'warn' | 'success' | 'danger';

interface Callout {
  step:    string;
  icon:    string;
  message: string;
  hint?:   string;
  anchor?: string;   // fragment link to a section id on the same page
  variant: Variant;
}

function computeCallout(activity: ActivityWithRelations): Callout {
  const hasPhotos   = activity.photos.length > 0;
  const hasCover    = activity.photos.some((p) => p.featured);
  const isPublished = activity.status === 'publicado';
  const isEligible  = activity.editorial_eligible;
  const narrative   = activity.narrative;
  const isApproved  = narrative?.status === 'aprobado';
  const isRechazado = narrative?.status === 'rechazado';

  // ── 6/6: Todo completo ────────────────────────────────────────────────────
  if (isApproved) return {
    step:    'Flujo completado',
    icon:    '★',
    message: 'El artículo está aprobado y visible en la Revista AO.',
    variant: 'success',
  };

  // ── Paso 2: Subir fotos ───────────────────────────────────────────────────
  if (!hasPhotos) return {
    step:    'Siguiente — Paso 2',
    icon:    '📷',
    message: 'Sube al menos una foto y márcala como portada (★).',
    hint:    'La portada aparece como imagen hero en el artículo de la Revista.',
    anchor:  'section-fotos',
    variant: 'info',
  };

  if (!hasCover) return {
    step:    'Siguiente — Paso 2',
    icon:    '★',
    message: 'Pasa el cursor sobre una foto y pulsa "☆ Marcar portada".',
    hint:    'Sin portada la actividad no puede pasar al siguiente paso.',
    anchor:  'section-fotos',
    variant: 'info',
  };

  // ── Paso 3: Publicar ──────────────────────────────────────────────────────
  if (!isPublished) return {
    step:    'Siguiente — Paso 3',
    icon:    '↑',
    message: 'Pulsa "↑ Publicar" en la sección Información.',
    hint:    'La publicación activa la generación de narrativa AI y la notificación push.',
    anchor:  'section-info',
    variant: 'warn',
  };

  // ── Paso 4: Elegibilidad ──────────────────────────────────────────────────
  if (!isEligible) return {
    step:    'Paso 4 — No elegible',
    icon:    '⚠',
    message: 'Esta actividad no está marcada como elegible para la Revista.',
    hint:    'Activa "Elegible para Narrativa AI y Revista" en la sección Información y guarda los cambios.',
    anchor:  'section-info',
    variant: 'warn',
  };

  // ── Paso 4: Narrativa rechazada ───────────────────────────────────────────
  if (isRechazado) return {
    step:    'Siguiente — Paso 4',
    icon:    '↺',
    message: 'La narrativa fue rechazada. Genera una nueva versión.',
    hint:    'Pulsa "↺ Regenerar narrativa" en la sección Narrativa AI.',
    anchor:  'section-narrativa',
    variant: 'danger',
  };

  // ── Paso 4: Generar narrativa ─────────────────────────────────────────────
  if (!narrative) return {
    step:    'Siguiente — Paso 4',
    icon:    '✦',
    message: 'La actividad está publicada. Genera la narrativa editorial AI.',
    hint:    'El proceso puede tardar 10–30 segundos. Recibirás el texto generado para revisarlo.',
    anchor:  'section-narrativa',
    variant: 'info',
  };

  // ── Paso 5: Aprobar narrativa ─────────────────────────────────────────────
  return {
    step:    'Siguiente — Paso 5',
    icon:    '✓',
    message: 'La narrativa está lista para revisión. Apruébala para publicarla en la Revista.',
    hint:    'Léela con cuidado. Si no convence, regenera una nueva versión antes de aprobar.',
    anchor:  'section-narrativa',
    variant: 'warn',
  };
}

// ── Variant styles ───────────────────────────────────────────────────────────

const styles: Record<Variant, {
  card:  string;
  iconBg: string;
  step:  string;
  body:  string;
}> = {
  info: {
    card:   'bg-blue-50 border-blue-200 hover:border-blue-300',
    iconBg: 'bg-blue-100 text-blue-600',
    step:   'text-blue-500',
    body:   'text-blue-900',
  },
  warn: {
    card:   'bg-amber-50 border-amber-200 hover:border-amber-300',
    iconBg: 'bg-amber-100 text-amber-600',
    step:   'text-amber-500',
    body:   'text-amber-900',
  },
  danger: {
    card:   'bg-red-50 border-red-200 hover:border-red-300',
    iconBg: 'bg-red-100 text-red-600',
    step:   'text-red-500',
    body:   'text-red-900',
  },
  success: {
    card:   'bg-green-50 border-green-200',
    iconBg: 'bg-green-100 text-green-600',
    step:   'text-green-600',
    body:   'text-green-900',
  },
};

// ── Component ────────────────────────────────────────────────────────────────

export function NextActionCallout({ activity }: Props) {
  const callout = computeCallout(activity);
  const s       = styles[callout.variant];

  const inner = (
    <div className={`flex items-start gap-3.5 border rounded-xl px-4 py-3.5 transition-colors ${s.card}`}>
      {/* Icon */}
      <div className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-[15px] font-bold ${s.iconBg}`}>
        {callout.icon}
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className={`text-[11px] font-bold uppercase tracking-widest mb-0.5 ${s.step}`}>
          {callout.step}
        </p>
        <p className={`text-sm font-semibold leading-snug ${s.body}`}>
          {callout.message}
        </p>
        {callout.hint && (
          <p className={`text-xs mt-1 leading-relaxed opacity-70 ${s.body}`}>
            {callout.hint}
          </p>
        )}
      </div>

      {/* Arrow indicator for clickable banners */}
      {callout.anchor && (
        <span className={`shrink-0 self-center text-base font-bold opacity-30 ${s.body}`}>
          ↓
        </span>
      )}
    </div>
  );

  if (callout.anchor) {
    return (
      <a href={`#${callout.anchor}`} className="block no-underline group">
        {inner}
      </a>
    );
  }

  return inner;
}
