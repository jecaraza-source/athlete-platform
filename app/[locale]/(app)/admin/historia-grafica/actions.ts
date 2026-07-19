'use server';
// =============================================================================
// app/[locale]/(app)/admin/historia-grafica/actions.ts
// Server actions for Historia Gráfica. Reuses the bitácora actions for
// activity/photo CRUD so we don't duplicate storage logic.
// =============================================================================

import { revalidatePath }  from 'next/cache';
import { createActivity }  from '@/lib/bitacora/actions';
import { upsertPhotos, deletePhoto } from '@/lib/bitacora/actions';
import { assertAdminAccess } from '@/lib/rbac/server';
import type { ActionResult } from '@/lib/types/bitacora';

// ─── Album (Activity) ─────────────────────────────────────────────────────────

export interface CreateAlbumInput {
  title:      string;
  event_date?: string;
  disciplina?: string;
  sede?:       string;
  tags?:       string[];
}

/**
 * Creates a new album (activity of type evento_deportivo) for Historia Gráfica.
 * Returns the new album id so the client can upload photos to it immediately.
 */
export async function createGalleryAlbum(
  input: CreateAlbumInput,
): Promise<ActionResult<{ id: string; slug: string }>> {
  const denied = await assertAdminAccess();
  if (denied) return { error: denied.error };

  const result = await createActivity({
    type:        'evento_deportivo',
    title:       input.title.trim(),
    event_date:  input.event_date ?? undefined,
    disciplina:  input.disciplina ?? undefined,
    sede:        input.sede       ?? undefined,
    tags:        [...(input.tags ?? []), 'historia_grafica'],
    // keep editorial_eligible false for gallery-only albums
    editorial_eligible: false,
  });

  if (result.error) return { error: result.error };

  revalidatePath('/admin/historia-grafica');
  return { error: null, data: result.data };
}

// ─── Photo ────────────────────────────────────────────────────────────────────

export interface AddPhotoInput {
  activity_id:  string;
  storage_path: string;
  caption?:     string;
  alt_text:     string;
  display_order: number;
}

/**
 * Registers an already-uploaded photo in the database.
 * The actual Storage upload happens client-side (browser Supabase client).
 */
export async function registerGalleryPhoto(
  input: AddPhotoInput,
): Promise<ActionResult<{ id: string }>> {
  const denied = await assertAdminAccess();
  if (denied) return { error: denied.error };

  const result = await upsertPhotos(input.activity_id, [
    {
      storage_path:  input.storage_path,
      caption:       input.caption,
      alt_text:      input.alt_text,
      display_order: input.display_order,
      featured:      false,
    },
  ]);

  if (result.error) return { error: result.error };

  revalidatePath('/admin/historia-grafica');
  return { error: null, data: { id: result.data?.[0]?.id ?? '' } };
}

/**
 * Deletes a photo from both Storage and the database.
 * Wraps the existing bitácora deletePhoto action.
 */
export async function deleteGalleryPhoto(
  photoId:     string,
  storagePath: string,
): Promise<ActionResult> {
  const denied = await assertAdminAccess();
  if (denied) return { error: denied.error };

  const result = await deletePhoto(photoId, storagePath);
  if (result.error) return { error: result.error };

  revalidatePath('/admin/historia-grafica');
  return { error: null };
}
