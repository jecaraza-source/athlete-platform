'use server';
// =============================================================================
// lib/bitacora/gallery-import-actions.ts
// Server actions for importing photos from Historia Gráfica into a Bitácora
// (Magazine) activity.
//
// Strategy: create new activity_photos records pointing to the same Supabase
// Storage paths. No files are duplicated — only DB records are added.
// This lets the same photo appear in Historia Gráfica AND in the Magazine.
// =============================================================================

import { revalidatePath }   from 'next/cache';
import { supabaseAdmin }    from '@/lib/supabase-admin';
import { assertMagazineAccess } from '@/lib/rbac/server';
import { upsertPhotos }     from '@/lib/bitacora/actions';
import type { ActionResult, PhotoInput } from '@/lib/types/bitacora';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ImportablePhoto {
  id:           string;
  activity_id:  string;
  storage_path: string;
  caption:      string | null;
  alt_text:     string;
  album_title:  string;
  album_date:   string | null;
  disciplina:   string | null;
  sede:         string | null;
}

// ─── Fetch ────────────────────────────────────────────────────────────────────

/**
 * Returns photos from other activities (Historia Gráfica albums) that can be
 * imported into the given target activity.
 *
 * Excludes photos already linked to `excludeActivityId` so the same photo
 * isn't imported twice.
 */
export async function fetchImportablePhotos(
  excludeActivityId: string,
): Promise<ImportablePhoto[]> {
  const denied = await assertMagazineAccess();
  if (denied) return [];

  // Two-query approach (avoids PostgREST join naming ambiguity).
  // Step 1: photos from all activities except the one being edited.
  const { data: photoRows, error: photoErr } = await supabaseAdmin
    .from('activity_photos')
    .select('id, activity_id, storage_path, caption, alt_text')
    .neq('activity_id', excludeActivityId)
    .order('created_at', { ascending: false })
    .limit(300);

  if (photoErr) {
    console.error('[fetchImportablePhotos] photos query error:', photoErr.message);
    return [];
  }
  if (!photoRows || photoRows.length === 0) return [];

  // Step 2: fetch activity metadata for those albums.
  const albumIds = [...new Set(photoRows.map((p: { activity_id: string }) => p.activity_id))];
  const { data: activityRows, error: actErr } = await supabaseAdmin
    .from('activities')
    .select('id, title, event_date, disciplina, sede')
    .in('id', albumIds);

  if (actErr) {
    console.error('[fetchImportablePhotos] activities query error:', actErr.message);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const actMap = new Map<string, any>(
    (activityRows ?? []).map((a: { id: string }) => [a.id, a]),
  );

  return (photoRows as {
    id: string; activity_id: string; storage_path: string;
    caption: string | null; alt_text: string;
  }[]).map((p) => {
    const act = actMap.get(p.activity_id);
    return {
      id:           p.id,
      activity_id:  p.activity_id,
      storage_path: p.storage_path,
      caption:      p.caption,
      alt_text:     p.alt_text,
      album_title:  act?.title      ?? '',
      album_date:   act?.event_date ?? null,
      disciplina:   act?.disciplina ?? null,
      sede:         act?.sede       ?? null,
    } satisfies ImportablePhoto;
  });
}

// ─── Import ───────────────────────────────────────────────────────────────────

/**
 * Imports selected photos into the target Bitácora activity.
 * Creates new activity_photos records pointing to the same Storage paths.
 * @param targetActivityId  The Magazine activity receiving the photos.
 * @param photos            Selected photos to import (storage_path + metadata).
 * @param startOrder        display_order offset (= current photo count).
 */
export async function importPhotosToActivity(
  targetActivityId: string,
  photos: { storage_path: string; caption: string | null; alt_text: string }[],
  startOrder: number,
): Promise<ActionResult<{ count: number }>> {
  const denied = await assertMagazineAccess();
  if (denied) return { error: denied.error };

  if (photos.length === 0) return { error: 'No hay fotos seleccionadas.' };

  const inputs: PhotoInput[] = photos.map((p, i) => ({
    storage_path:  p.storage_path,
    caption:       p.caption ?? undefined,
    alt_text:      p.alt_text,
    display_order: startOrder + i,
    featured:      false,
  }));

  const result = await upsertPhotos(targetActivityId, inputs);
  if (result.error) return { error: result.error };

  revalidatePath(`/admin/bitacora/${targetActivityId}/editar`);
  return { error: null, data: { count: photos.length } };
}
