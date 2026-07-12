// =============================================================================
// lib/bitacora/stepper-logic.ts
// Pure function — computes the 6-step editorial publication flow state.
// No side effects, no I/O. Used by BitacoraPublishStepper and its tests.
// =============================================================================

import type { ActivityWithRelations } from '@/lib/types/bitacora';

export type StepState = 'done' | 'active' | 'locked';

export interface PublishStep {
  id:        number;
  label:     string;
  sublabel?: string;
  state:     StepState;
  /** Only set for step 6 when the narrative is approved. */
  href?:     string;
}

/**
 * Derives the six publish-flow step descriptors from the current activity state.
 *
 * Steps:
 *  1. Actividad creada         — always done (we're on the edit page)
 *  2. Fotos + portada          — done when a photo is marked as featured
 *  3. Publicar actividad       — done when status === 'publicado'
 *  4. Generar narrativa AI     — done when a non-rejected narrative exists
 *  5. Aprobar narrativa        — done when narrative.status === 'aprobado'
 *  6. Visible en Revista       — done == step 5; shows link to /revista/:id
 */
export function computePublishSteps(
  activity: Pick<
    ActivityWithRelations,
    'status' | 'editorial_eligible' | 'photos' | 'narrative'
  >,
  locale: string,
): PublishStep[] {
  const hasPhotos    = activity.photos.length > 0;
  const hasCover     = activity.photos.some((p) => p.featured);
  const isPublished  = activity.status === 'publicado';
  const isEligible   = activity.editorial_eligible;
  const narrative    = activity.narrative;
  const hasNarrative = narrative !== null;
  const isApproved   = narrative?.status === 'aprobado';
  const isRechazado  = narrative?.status === 'rechazado';
  const narrativeId  = narrative?.id;

  return [
    // ── 1. Actividad creada ────────────────────────────────────────────────
    {
      id:       1,
      label:    'Actividad',
      sublabel: 'creada',
      state:    'done',
    },

    // ── 2. Fotos subidas + portada marcada ────────────────────────────────
    {
      id:       2,
      label:    'Fotos',
      sublabel: hasCover
        ? '★ Portada lista'
        : hasPhotos
        ? 'Marca una portada'
        : 'Sin fotos',
      state: hasCover ? 'done' : 'active',
    },

    // ── 3. Publicar actividad ─────────────────────────────────────────────
    {
      id:    3,
      label: 'Publicar',
      state: isPublished
        ? 'done'
        : hasCover
        ? 'active'
        : 'locked',
    },

    // ── 4. Generar narrativa AI ───────────────────────────────────────────
    {
      id:       4,
      label:    'Narrativa',
      sublabel: !isEligible
        ? 'No elegible'
        : isRechazado
        ? '↺ Regenerar'
        : hasNarrative
        ? 'generada'
        : undefined,
      state: !isPublished || !isEligible
        ? 'locked'
        : hasNarrative && !isRechazado
        ? 'done'
        : 'active',
    },

    // ── 5. Aprobar narrativa ──────────────────────────────────────────────
    {
      id:    5,
      label: 'Aprobar',
      state: isApproved
        ? 'done'
        : hasNarrative && !isRechazado
        ? 'active'
        : 'locked',
    },

    // ── 6. Visible en Revista ─────────────────────────────────────────────
    {
      id:       6,
      label:    'Revista',
      sublabel: isApproved && narrativeId ? 'Ver artículo →' : undefined,
      href:     isApproved && narrativeId
        ? `/${locale}/revista/${narrativeId}`
        : undefined,
      state:    isApproved ? 'done' : 'locked',
    },
  ];
}
