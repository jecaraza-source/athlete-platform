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
