'use server';
// =============================================================================
// lib/bitacora/actions.ts
// Server Actions para el módulo Bitácora.
// Todas las mutaciones requieren acceso admin (assertAdminAccess).
// =============================================================================

import { revalidatePath } from 'next/cache';
import { supabaseAdmin }   from '@/lib/supabase-admin';
import { assertAdminAccess, getAuthUser } from '@/lib/rbac/server';
import { generateUniqueSlug, slugify }   from './slug-utils';
import { notifyActivityPublished, notifyMagazineIssuePublished } from './notifications';
import { ACTIVITY_PHOTOS_BUCKET } from '@/lib/storage-config';
import type {
  ActivityInput,
  ActivityStatus,
  ActionResult,
  PhotoInput,
  CommentInput,
} from '@/lib/types/bitacora';

// ---------------------------------------------------------------------------
// Actividades
// ---------------------------------------------------------------------------

export async function createActivity(
  input: ActivityInput
): Promise<ActionResult<{ id: string; slug: string }>> {
  const denied = await assertAdminAccess();
  if (denied) return { error: denied.error };

  const authUser = await getAuthUser();

  // Generar slug único
  const slug = input.slug?.trim()
    ? slugify(input.slug)
    : await generateUniqueSlug(
        input.title,
        input.event_date,
        async (s) => {
          const { data } = await supabaseAdmin
            .from('activities')
            .select('id')
            .eq('slug', s)
            .maybeSingle();
          return data !== null;
        }
      );

  // editorial_eligible: el trigger SQL fija false para 'consulta';
  // aquí respetamos el valor explícito si se pasó.
  const editorialEligible =
    input.editorial_eligible !== undefined
      ? input.editorial_eligible
      : input.type === 'evento_deportivo';

  const { data, error } = await supabaseAdmin
    .from('activities')
    .insert({
      type:               input.type,
      title:              input.title,
      slug,
      description:        input.description ?? null,
      event_date:         input.event_date   ?? null,
      location:           input.location     ?? null,
      tags:               input.tags         ?? [],
      editorial_eligible: editorialEligible,
      created_by:         authUser?.id       ?? null,
    })
    .select('id, slug')
    .single();

  if (error) return { error: error.message };

  revalidatePath('/bitacora');
  revalidatePath('/admin/bitacora');
  return { error: null, data: { id: data.id, slug: data.slug } };
}

export async function updateActivity(
  id:    string,
  input: Partial<ActivityInput>
): Promise<ActionResult> {
  const denied = await assertAdminAccess();
  if (denied) return { error: denied.error };

  const updates: Record<string, unknown> = {};
  if (input.title       !== undefined) updates.title       = input.title;
  if (input.description !== undefined) updates.description = input.description ?? null;
  if (input.event_date  !== undefined) updates.event_date  = input.event_date  ?? null;
  if (input.location    !== undefined) updates.location    = input.location    ?? null;
  if (input.tags        !== undefined) updates.tags        = input.tags;
  if (input.editorial_eligible !== undefined) updates.editorial_eligible = input.editorial_eligible;

  // Si cambia el título, regenerar el slug
  if (input.title && !input.slug) {
    const { data: current } = await supabaseAdmin
      .from('activities')
      .select('event_date, slug')
      .eq('id', id)
      .maybeSingle();

    const newSlug = await generateUniqueSlug(
      input.title,
      input.event_date ?? current?.event_date,
      async (s) => {
        if (s === current?.slug) return false; // mismo slug, no conflicto
        const { data } = await supabaseAdmin
          .from('activities')
          .select('id')
          .eq('slug', s)
          .maybeSingle();
        return data !== null;
      }
    );
    updates.slug = newSlug;
  } else if (input.slug) {
    updates.slug = slugify(input.slug);
  }

  const { error } = await supabaseAdmin
    .from('activities')
    .update(updates)
    .eq('id', id);

  if (error) return { error: error.message };

  revalidatePath('/bitacora');
  revalidatePath('/admin/bitacora');
  revalidatePath(`/admin/bitacora/${id}/editar`);
  return { error: null };
}

export async function publishActivity(
  id:          string,
  sendPush:    boolean = true
): Promise<ActionResult> {
  const denied = await assertAdminAccess();
  if (denied) return { error: denied.error };

  const { data: activity, error: fetchErr } = await supabaseAdmin
    .from('activities')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (fetchErr || !activity) return { error: 'Actividad no encontrada.' };
  if (activity.status === 'publicado') return { error: null }; // ya publicada

  const { error } = await supabaseAdmin
    .from('activities')
    .update({ status: 'publicado' as ActivityStatus })
    .eq('id', id);

  if (error) return { error: error.message };

  // Notificación push (si no se ha enviado antes y el toggle está activo)
  if (sendPush && !activity.notified_at) {
    await notifyActivityPublished(id);
  }

  revalidatePath('/bitacora');
  revalidatePath(`/bitacora/${activity.slug}`);
  revalidatePath('/admin/bitacora');
  return { error: null };
}

export async function unpublishActivity(id: string): Promise<ActionResult> {
  const denied = await assertAdminAccess();
  if (denied) return { error: denied.error };

  const { error } = await supabaseAdmin
    .from('activities')
    .update({ status: 'borrador' as ActivityStatus })
    .eq('id', id);

  if (error) return { error: error.message };

  revalidatePath('/bitacora');
  revalidatePath('/admin/bitacora');
  return { error: null };
}

export async function deleteActivity(id: string): Promise<ActionResult> {
  const denied = await assertAdminAccess();
  if (denied) return { error: denied.error };

  // Eliminar fotos del storage
  const { data: photos } = await supabaseAdmin
    .from('activity_photos')
    .select('storage_path')
    .eq('activity_id', id);

  if (photos && photos.length > 0) {
    const paths = photos.map((p: { storage_path: string }) => p.storage_path);
    await supabaseAdmin.storage.from(ACTIVITY_PHOTOS_BUCKET).remove(paths);
  }

  const { error } = await supabaseAdmin
    .from('activities')
    .delete()
    .eq('id', id);

  if (error) return { error: error.message };

  revalidatePath('/bitacora');
  revalidatePath('/admin/bitacora');
  return { error: null };
}

// ---------------------------------------------------------------------------
// Fotos
// ---------------------------------------------------------------------------

export async function upsertPhotos(
  activityId: string,
  photos:     PhotoInput[]
): Promise<ActionResult> {
  const denied = await assertAdminAccess();
  if (denied) return { error: denied.error };

  if (photos.length === 0) return { error: null };

  const rows = photos.map((p) => ({
    activity_id:   activityId,
    storage_path:  p.storage_path,
    caption:       p.caption      ?? null,
    display_order: p.display_order,
    alt_text:      p.alt_text,
    featured:      p.featured,
  }));

  const { error } = await supabaseAdmin
    .from('activity_photos')
    .upsert(rows, { onConflict: 'storage_path', ignoreDuplicates: false });

  if (error) return { error: error.message };

  revalidatePath(`/admin/bitacora/${activityId}/editar`);
  return { error: null };
}

export async function deletePhoto(
  photoId:     string,
  storagePath: string
): Promise<ActionResult> {
  const denied = await assertAdminAccess();
  if (denied) return { error: denied.error };

  // Eliminar del storage primero
  await supabaseAdmin.storage.from(ACTIVITY_PHOTOS_BUCKET).remove([storagePath]);

  const { error } = await supabaseAdmin
    .from('activity_photos')
    .delete()
    .eq('id', photoId);

  if (error) return { error: error.message };
  return { error: null };
}

export async function reorderPhotos(
  activityId: string,
  orderedIds: string[]
): Promise<ActionResult> {
  const denied = await assertAdminAccess();
  if (denied) return { error: denied.error };

  const updates = orderedIds.map((photoId, index) =>
    supabaseAdmin
      .from('activity_photos')
      .update({ display_order: index })
      .eq('id', photoId)
      .eq('activity_id', activityId)
  );

  await Promise.all(updates);
  return { error: null };
}

export async function setFeaturedPhoto(
  activityId: string,
  photoId:    string
): Promise<ActionResult> {
  const denied = await assertAdminAccess();
  if (denied) return { error: denied.error };

  // Quitar featured de todas las fotos de la actividad
  await supabaseAdmin
    .from('activity_photos')
    .update({ featured: false })
    .eq('activity_id', activityId);

  // Poner featured en la foto seleccionada
  const { error } = await supabaseAdmin
    .from('activity_photos')
    .update({ featured: true })
    .eq('id', photoId);

  if (error) return { error: error.message };

  revalidatePath(`/admin/bitacora/${activityId}/editar`);
  return { error: null };
}

// ---------------------------------------------------------------------------
// Comentarios
// ---------------------------------------------------------------------------

/** Inserción pública (sin autenticación). approved=false siempre. */
export async function submitComment(input: CommentInput): Promise<ActionResult> {
  if (!input.author_name?.trim()) return { error: 'El nombre es requerido.' };
  if (!input.comment?.trim())     return { error: 'El comentario no puede estar vacío.' };
  if (input.comment.length > 1000) return { error: 'El comentario es demasiado largo (máx. 1000 caracteres).' };

  const { error } = await supabaseAdmin
    .from('activity_comments')
    .insert({
      activity_id:  input.activity_id,
      author_name:  input.author_name.trim(),
      author_email: input.author_email?.trim() ?? null,
      comment:      input.comment.trim(),
      approved:     false,
    });

  if (error) return { error: error.message };
  return { error: null };
}

export async function moderateComment(
  commentId: string,
  approved:  boolean
): Promise<ActionResult> {
  const denied = await assertAdminAccess();
  if (denied) return { error: denied.error };

  const { error } = await supabaseAdmin
    .from('activity_comments')
    .update({ approved })
    .eq('id', commentId);

  if (error) return { error: error.message };
  revalidatePath('/admin/bitacora');
  return { error: null };
}

export async function deleteComment(commentId: string): Promise<ActionResult> {
  const denied = await assertAdminAccess();
  if (denied) return { error: denied.error };

  const { error } = await supabaseAdmin
    .from('activity_comments')
    .delete()
    .eq('id', commentId);

  if (error) return { error: error.message };
  return { error: null };
}

// ---------------------------------------------------------------------------
// Narrativas AI
// ---------------------------------------------------------------------------

export async function approveNarrative(narrativeId: string): Promise<ActionResult> {
  const denied = await assertAdminAccess();
  if (denied) return { error: denied.error };

  const authUser = await getAuthUser();

  const { error } = await supabaseAdmin
    .from('activity_narratives')
    .update({
      status:      'aprobado',
      approved_by: authUser?.id ?? null,
      approved_at: new Date().toISOString(),
    })
    .eq('id', narrativeId);

  if (error) return { error: error.message };

  revalidatePath('/revista');
  revalidatePath('/bitacora');
  return { error: null };
}

export async function rejectNarrative(narrativeId: string): Promise<ActionResult> {
  const denied = await assertAdminAccess();
  if (denied) return { error: denied.error };

  const { error } = await supabaseAdmin
    .from('activity_narratives')
    .update({ status: 'rechazado', approved_by: null, approved_at: null })
    .eq('id', narrativeId);

  if (error) return { error: error.message };
  return { error: null };
}

export async function deleteNarrative(narrativeId: string): Promise<ActionResult> {
  const denied = await assertAdminAccess();
  if (denied) return { error: denied.error };

  const { error } = await supabaseAdmin
    .from('activity_narratives')
    .delete()
    .eq('id', narrativeId);

  if (error) return { error: error.message };
  return { error: null };
}

// ---------------------------------------------------------------------------
// Revista (magazine_issues)
// ---------------------------------------------------------------------------

export async function createMagazineIssue(data: {
  title:        string;
  period_start?: string;
  period_end?:   string;
  activity_ids?: string[];
}): Promise<ActionResult<{ id: string }>> {
  const denied = await assertAdminAccess();
  if (denied) return { error: denied.error };

  const authUser = await getAuthUser();

  const { data: issue, error } = await supabaseAdmin
    .from('magazine_issues')
    .insert({
      title:        data.title,
      period_start: data.period_start ?? null,
      period_end:   data.period_end   ?? null,
      activity_ids: data.activity_ids ?? [],
      created_by:   authUser?.id      ?? null,
    })
    .select('id')
    .single();

  if (error) return { error: error.message };

  revalidatePath('/admin/bitacora');
  return { error: null, data: { id: issue.id } };
}

export async function updateMagazineIssue(
  id:   string,
  data: { title?: string; period_start?: string; period_end?: string; activity_ids?: string[] }
): Promise<ActionResult> {
  const denied = await assertAdminAccess();
  if (denied) return { error: denied.error };

  const updates: Record<string, unknown> = {};
  if (data.title        !== undefined) updates.title        = data.title;
  if (data.period_start !== undefined) updates.period_start = data.period_start ?? null;
  if (data.period_end   !== undefined) updates.period_end   = data.period_end   ?? null;
  if (data.activity_ids !== undefined) updates.activity_ids = data.activity_ids;

  const { error } = await supabaseAdmin
    .from('magazine_issues')
    .update(updates)
    .eq('id', id);

  if (error) return { error: error.message };

  revalidatePath('/revista');
  revalidatePath('/admin/bitacora');
  return { error: null };
}

export async function publishMagazineIssue(
  id:       string,
  sendPush: boolean = true
): Promise<ActionResult> {
  const denied = await assertAdminAccess();
  if (denied) return { error: denied.error };

  const { data: issue, error: fetchErr } = await supabaseAdmin
    .from('magazine_issues')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (fetchErr || !issue) return { error: 'Edición no encontrada.' };
  if (issue.status === 'publicado') return { error: null };

  const { error } = await supabaseAdmin
    .from('magazine_issues')
    .update({ status: 'publicado', published_at: new Date().toISOString() })
    .eq('id', id);

  if (error) return { error: error.message };

  if (sendPush && !issue.notified_at) {
    await notifyMagazineIssuePublished(id, issue.title);
  }

  revalidatePath('/revista');
  revalidatePath('/admin/bitacora');
  return { error: null };
}

export async function deleteMagazineIssue(id: string): Promise<ActionResult> {
  const denied = await assertAdminAccess();
  if (denied) return { error: denied.error };

  const { error } = await supabaseAdmin
    .from('magazine_issues')
    .delete()
    .eq('id', id);

  if (error) return { error: error.message };

  revalidatePath('/revista');
  revalidatePath('/admin/bitacora');
  return { error: null };
}
