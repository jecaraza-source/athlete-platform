// =============================================================================
// services/attachments.ts
// Athlete attachment queries for the mobile app.
// Reads from `athlete_attachments` table and generates signed download URLs
// from the `athlete-files` Supabase storage bucket.
//
// NOTE: The `athlete_attachments` table may require an explicit RLS SELECT
// policy for the anon/authenticated role.  If the query returns an empty
// array unexpectedly, apply a policy in Supabase similar to:
//
//   CREATE POLICY "Authenticated users can read athlete_attachments"
//     ON athlete_attachments FOR SELECT TO authenticated
//     USING (true);
// =============================================================================

import { supabase } from '@/lib/supabase';
import type { ImagePickerAsset } from 'expo-image-picker';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AthleteAttachment = {
  id:                  string;
  athlete_id:          string;
  module_name:         string;
  section_name:        string | null;
  related_record_id:   string | null;
  file_name_original:  string;
  file_path:           string;
  mime_type:           string;
  file_extension:      string | null;
  file_size:           number | null;
  description:         string | null;
  uploaded_at:         string;
};

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * Lists active attachments for an athlete, most recent first.
 *
 * @param athleteId   - UUID of the athlete record
 * @param moduleFilter - Optional: restrict to a specific module
 *                       ('diagnostic', 'training', 'nutrition', …)
 * @param limit        - Maximum rows to return (default 30)
 */
export async function listAthleteAttachments(
  athleteId:    string,
  moduleFilter?: string,
  limit = 30,
): Promise<AthleteAttachment[]> {
  let query = supabase
    .from('athlete_attachments')
    .select(
      'id, athlete_id, module_name, section_name, related_record_id, ' +
      'file_name_original, file_path, mime_type, file_extension, ' +
      'file_size, description, uploaded_at'
    )
    .eq('athlete_id', athleteId)
    .eq('is_active', true)
    .order('uploaded_at', { ascending: false })
    .limit(limit);

  if (moduleFilter) {
    query = query.eq('module_name', moduleFilter);
  }

  const { data, error } = await query;
  if (error) {
    console.warn('[attachments] listAthleteAttachments error:', error.message);
    return [];
  }
  return (data ?? []) as unknown as AthleteAttachment[];
}

/**
 * Creates a signed URL (valid 1 hour) for a file in the `athlete-files` bucket.
 * Returns null if the storage call fails (e.g. bucket policy not set).
 */
export async function getAttachmentSignedUrl(filePath: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from('athlete-files')
    .createSignedUrl(filePath, 60 * 60); // 1 hour

  if (error) {
    console.warn('[attachments] getAttachmentSignedUrl error:', error.message);
    return null;
  }
  return data?.signedUrl ?? null;
}

// ---------------------------------------------------------------------------
// Upload (from mobile image picker)
// ---------------------------------------------------------------------------

/**
 * Uploads an image selected via expo-image-picker to the `athlete-files`
 * Supabase Storage bucket and inserts a row in `athlete_attachments`.
 *
 * @param asset       - The ImagePickerAsset returned by launchImageLibraryAsync
 * @param athleteId   - UUID of the athlete record
 * @param moduleTag   - Module label stored in module_name (e.g. 'seguimiento')
 * @param description - Optional description shown in the attachment list
 *
 * Returns { ok: true } on success or { ok: false, error: string } on failure.
 */
export async function uploadAthleteAttachment(
  asset: ImagePickerAsset,
  athleteId:   string,
  moduleTag  = 'seguimiento',
  description?: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    // 1. Derive file metadata
    const ext  = asset.uri.split('.').pop()?.toLowerCase() ?? 'jpg';
    const mime = asset.type === 'image' ? `image/${ext === 'jpg' ? 'jpeg' : ext}` : 'application/octet-stream';
    const name = `${Date.now()}_${athleteId.slice(0, 8)}.${ext}`;
    const path = `athletes/${athleteId}/${name}`;

    // 2. Upload to athlete-files bucket.
    //    We build FormData ourselves so Supabase hits the FormData branch of
    //    uploadOrUpdate (which doesn't set Content-Type). The plain-object
    //    branch would hard-code 'text/plain;charset=UTF-8' and fail.
    //    React Native's native fetch sets the correct multipart boundary.
    const uploadForm = new FormData();
    uploadForm.append('', { uri: asset.uri, name, type: mime } as unknown as Blob);
    const { error: uploadError } = await supabase.storage
      .from('athlete-files')
      .upload(path, uploadForm, { upsert: false });

    if (uploadError) {
      console.warn('[attachments] upload error:', uploadError.message);
      return { ok: false, error: uploadError.message };
    }

    // 4. Insert row in athlete_attachments
    const { error: dbError } = await supabase
      .from('athlete_attachments')
      .insert({
        athlete_id:           athleteId,
        module_name:          moduleTag,
        file_name_original:   name,
        file_name_storage:    name,          // NOT NULL in DB
        file_path:            path,
        mime_type:            mime,
        file_extension:       ext,
        file_size:            asset.fileSize ?? 0,  // NOT NULL in DB
        description:          description ?? null,
        is_active:            true,
      });

    if (dbError) {
      console.warn('[attachments] db insert error:', dbError.message);
      // Best-effort cleanup: delete the orphaned storage file
      await supabase.storage.from('athlete-files').remove([path]);
      return { ok: false, error: dbError.message };
    }

    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn('[attachments] unexpected error:', msg);
    return { ok: false, error: msg };
  }
}

// ---------------------------------------------------------------------------
// Generic file upload (supports both image-picker and document-picker assets)
// ---------------------------------------------------------------------------

/**
 * A normalised file descriptor that can be built from either
 * expo-image-picker's `ImagePickerAsset` or expo-document-picker's
 * `DocumentPickerAsset`.
 */
export type UploadableFile = {
  uri:      string;
  name:     string;
  mimeType: string;
  size:     number | null;
};

/**
 * Uploads a file to the `athlete-files` Supabase Storage bucket and inserts
 * a row in `athlete_attachments` linked to a specific training session.
 *
 * @param file      - Normalised file descriptor (from image or document picker)
 * @param athleteId - UUID of the athlete record
 * @param sessionId - UUID of the training session (stored as related_record_id)
 *
 * Returns `{ ok: true }` on success or `{ ok: false, error }` on failure.
 */
export async function uploadSessionFile(
  file:      UploadableFile,
  athleteId: string,
  sessionId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const ext      = file.name.split('.').pop()?.toLowerCase() ?? 'bin';
    const safeName = `${Date.now()}_${athleteId.slice(0, 8)}.${ext}`;
    const path     = `athletes/${athleteId}/training/${safeName}`;

    // Same FormData pattern: wrap the RN file object so Supabase hits the
    // FormData branch and doesn't override Content-Type.
    const uploadForm = new FormData();
    uploadForm.append('', { uri: file.uri, name: safeName, type: file.mimeType } as unknown as Blob);
    const { error: uploadError } = await supabase.storage
      .from('athlete-files')
      .upload(path, uploadForm, { upsert: false });

    if (uploadError) {
      console.warn('[attachments] uploadSessionFile storage error:', uploadError.message);
      return { ok: false, error: uploadError.message };
    }

    const { error: dbError } = await supabase
      .from('athlete_attachments')
      .insert({
        athlete_id:          athleteId,
        module_name:         'training',
        section_name:        'session',
        related_record_id:   sessionId,
        file_name_original:  file.name,
        file_name_storage:   safeName,       // NOT NULL in DB
        file_path:           path,
        mime_type:           file.mimeType,
        file_extension:      ext,
        file_size:           file.size ?? 0, // NOT NULL in DB
        is_active:           true,
      });

    if (dbError) {
      console.warn('[attachments] uploadSessionFile db error:', dbError.message);
      await supabase.storage.from('athlete-files').remove([path]);
      return { ok: false, error: dbError.message };
    }

    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn('[attachments] uploadSessionFile unexpected error:', msg);
    return { ok: false, error: msg };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns a human-readable file size string (e.g. "2.4 MB", "340 KB"). */
export function formatFileSize(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * Returns the module label in Spanish for display in the mobile UI.
 */
export const MODULE_LABELS: Record<string, string> = {
  diagnostic: 'Diagnóstico',
  training:   'Entrenamiento',
  nutrition:  'Nutrición',
  physio:     'Fisioterapia',
  psychology: 'Psicología',
  medical:    'Médico',
};
