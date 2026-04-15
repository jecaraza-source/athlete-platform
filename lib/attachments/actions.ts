'use server';

import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { assertPermission, getCurrentUser } from '@/lib/rbac/server';
import {
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
  MAX_FILES_PER_UPLOAD,
  getExtension,
  type AthleteAttachment,
  type UploadAttachmentParams,
  type ListAttachmentsParams,
} from '@/lib/types/attachments';

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

const BUCKET = 'athlete-files';

/** Crea el bucket si no existe. Los errores se ignoran (ya existe). */
async function ensureBucket() {
  await supabaseAdmin.storage.createBucket(BUCKET, {
    public: false,
    fileSizeLimit: MAX_FILE_SIZE_BYTES,
  });
}

// ---------------------------------------------------------------------------
// Subir uno o varios archivos
// ---------------------------------------------------------------------------

/**
 * Sube múltiples archivos y los registra en `athlete_attachments`.
 * Requiere permiso `edit_athletes`.
 */
export async function uploadAttachments(
  params: UploadAttachmentParams,
  formData: FormData
): Promise<{ errors: string[]; uploaded: number }> {
  const denied = await assertPermission('edit_athletes');
  if (denied) return { errors: [denied.error], uploaded: 0 };

  const currentUser = await getCurrentUser();
  const uploaderProfileId = currentUser?.profile?.id ?? null;

  const files = formData.getAll('files') as File[];

  if (!files.length || (files.length === 1 && files[0].size === 0)) {
    return { errors: ['No se seleccionaron archivos.'], uploaded: 0 };
  }

  if (files.length > MAX_FILES_PER_UPLOAD) {
    return {
      errors: [`Máximo ${MAX_FILES_PER_UPLOAD} archivos por carga.`],
      uploaded: 0,
    };
  }

  // Validar todos antes de subir
  const validationErrors: string[] = [];
  for (const file of files) {
    if (file.size > MAX_FILE_SIZE_BYTES) {
      validationErrors.push(`"${file.name}" excede el tamaño máximo de 50 MB.`);
    }
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      validationErrors.push(`"${file.name}" tiene un tipo de archivo no permitido (${file.type}).`);
    }
  }
  if (validationErrors.length > 0) return { errors: validationErrors, uploaded: 0 };

  await ensureBucket();

  const uploadErrors: string[] = [];
  let uploaded = 0;

  for (const file of files) {
    const ext = getExtension(file.name);
    const storageName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const storagePath = `${params.athleteId}/${params.module}/${storageName}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(storagePath, buffer, { contentType: file.type, upsert: false });

    if (uploadError) {
      uploadErrors.push(`"${file.name}": ${uploadError.message}`);
      continue;
    }

    const { error: dbError } = await supabaseAdmin.from('athlete_attachments').insert({
      athlete_id:         params.athleteId,
      module_name:        params.module,
      section_name:       params.sectionName ?? null,
      related_record_id:  params.relatedRecordId ?? null,
      file_name_original: file.name,
      file_name_storage:  storageName,
      file_path:          storagePath,
      mime_type:          file.type,
      file_extension:     ext,
      file_size:          file.size,
      description:        params.description ?? null,
      uploaded_by:        uploaderProfileId,
    });

    if (dbError) {
      // El archivo ya está en storage; intentar limpiarlo
      await supabaseAdmin.storage.from(BUCKET).remove([storagePath]);
      uploadErrors.push(`"${file.name}": ${dbError.message}`);
      continue;
    }

    uploaded++;
  }

  // Revalidar rutas afectadas
  revalidatePath(`/athletes/${params.athleteId}`);
  revalidatePath(`/athletes/${params.athleteId}/diagnostic`);
  revalidatePath('/follow-up/medical');
  revalidatePath('/follow-up/nutrition');
  revalidatePath('/follow-up/physio');
  revalidatePath('/follow-up/psychology');
  revalidatePath('/follow-up/training');

  return { errors: uploadErrors, uploaded };
}

// ---------------------------------------------------------------------------
// Listar adjuntos
// ---------------------------------------------------------------------------

/**
 * Lista los adjuntos activos de un atleta, opcionalmente filtrados por
 * módulo, sección o registro relacionado.
 * Requiere permiso `view_athletes`.
 */
export async function listAttachments(
  params: ListAttachmentsParams
): Promise<AthleteAttachment[]> {
  const denied = await assertPermission('view_athletes');
  if (denied) return [];

  let query = supabaseAdmin
    .from('athlete_attachments')
    .select(
      'id, athlete_id, module_name, section_name, related_record_id, ' +
      'file_name_original, file_name_storage, file_path, mime_type, ' +
      'file_extension, file_size, description, ' +
      'uploaded_by, uploaded_at, updated_at, deleted_by, deleted_at, is_active, ' +
      'uploader:profiles!uploaded_by(first_name, last_name)'
    )
    .eq('athlete_id', params.athleteId)
    .eq('is_active', true)
    .order('uploaded_at', { ascending: false });

  if (params.module) {
    query = query.eq('module_name', params.module);
  }

  if (params.relatedRecordId) {
    query = query.eq('related_record_id', params.relatedRecordId);
  }

  if (params.sectionName) {
    query = query.eq('section_name', params.sectionName);
  }

  const { data, error } = await query;

  if (error) {
    // Suppress expected error when the migration hasn't been applied yet
    const isTableMissing = error.message?.includes('athlete_attachments') ||
      error.message?.includes('schema cache');
    if (!isTableMissing) {
      console.error('[listAttachments]', error.message);
    }
    return [];
  }

  return (data ?? []) as unknown as AthleteAttachment[];
}

// ---------------------------------------------------------------------------
// URL firmada para descargar / previsualizar
// ---------------------------------------------------------------------------

/**
 * Genera una URL firmada (válida 1 hora) para descargar o previsualizar
 * un archivo desde el storage privado.
 */
export async function getAttachmentSignedUrl(
  filePath: string
): Promise<string | null> {
  const { data } = await supabaseAdmin.storage
    .from(BUCKET)
    .createSignedUrl(filePath, 60 * 60); // 1 hora
  return data?.signedUrl ?? null;
}

/**
 * Genera URLs firmadas para un array de adjuntos.
 * Devuelve un Map<attachmentId, signedUrl>.
 */
export async function getAttachmentSignedUrls(
  attachments: Pick<AthleteAttachment, 'id' | 'file_path'>[]
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  await Promise.all(
    attachments.map(async (a) => {
      const url = await getAttachmentSignedUrl(a.file_path);
      if (url) map.set(a.id, url);
    })
  );
  return map;
}

// ---------------------------------------------------------------------------
// Editar descripción
// ---------------------------------------------------------------------------

/**
 * Actualiza la descripción de un adjunto.
 * Requiere permiso `edit_athletes`.
 */
export async function updateAttachmentDescription(
  attachmentId: string,
  description: string
): Promise<{ error: string | null }> {
  const denied = await assertPermission('edit_athletes');
  if (denied) return denied;

  const { error } = await supabaseAdmin
    .from('athlete_attachments')
    .update({ description: description.trim() || null, updated_at: new Date().toISOString() })
    .eq('id', attachmentId);

  if (error) return { error: error.message };

  // Revalidate broadly (no sabemos el athlete_id desde aquí sin query extra)
  revalidatePath('/athletes', 'layout');
  revalidatePath('/follow-up', 'layout');

  return { error: null };
}

// ---------------------------------------------------------------------------
// Eliminar (baja lógica)
// ---------------------------------------------------------------------------

/**
 * Desactiva un adjunto (baja lógica). El objeto en storage se mantiene.
 * Requiere permiso `delete_athletes`.
 */
export async function deleteAttachment(
  attachmentId: string
): Promise<{ error: string | null }> {
  const denied = await assertPermission('delete_athletes');
  if (denied) return denied;

  const currentUser = await getCurrentUser();
  const deleterProfileId = currentUser?.profile?.id ?? null;

  // Primero obtenemos el path del archivo para el revalidate
  const { data: row, error: fetchError } = await supabaseAdmin
    .from('athlete_attachments')
    .select('athlete_id, file_path')
    .eq('id', attachmentId)
    .single();

  if (fetchError || !row) return { error: fetchError?.message ?? 'Adjunto no encontrado.' };

  const { error } = await supabaseAdmin
    .from('athlete_attachments')
    .update({
      is_active:   false,
      deleted_by:  deleterProfileId,
      deleted_at:  new Date().toISOString(),
    })
    .eq('id', attachmentId);

  if (error) return { error: error.message };

  revalidatePath(`/athletes/${row.athlete_id}`);
  revalidatePath(`/athletes/${row.athlete_id}/diagnostic`);
  revalidatePath('/follow-up/medical');
  revalidatePath('/follow-up/nutrition');
  revalidatePath('/follow-up/physio');
  revalidatePath('/follow-up/psychology');
  revalidatePath('/follow-up/training');

  return { error: null };
}
