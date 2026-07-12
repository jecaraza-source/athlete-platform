// =============================================================================
// services/protocols.ts
// Fetch protocol records and generate signed download URLs for mobile.
// Reads from the 'protocols' table and 'protocols' Storage bucket.
// RLS allows any authenticated user to SELECT (migration 017).
// =============================================================================

import { supabase } from '@/lib/supabase';

export type DisciplineKey = 'coach' | 'physio' | 'medic' | 'nutrition' | 'psychology';

export type Protocol = {
  id:          string;
  discipline:  DisciplineKey;
  title:       string | null;
  version:     string | null;
  file_path:   string;
  file_name:   string;
  file_size:   number | null;
  updated_at:  string;
};

/** Fetch all available protocols, ordered by discipline. */
export async function listProtocols(): Promise<Protocol[]> {
  const { data, error } = await supabase
    .from('protocols')
    .select('id, discipline, title, version, file_path, file_name, file_size, updated_at')
    .order('discipline');
  if (error) {
    console.warn('[protocols] listProtocols error:', error.message);
    return [];
  }
  return (data ?? []) as Protocol[];
}

/**
 * Creates a signed URL (valid 1 hour) for a protocol PDF.
 * Uses the authenticated client — requires the storage SELECT policy from 017.
 */
export async function getProtocolSignedUrl(filePath: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from('protocols')
    .createSignedUrl(filePath, 60 * 60); // 1 hour
  if (error) {
    console.warn('[protocols] createSignedUrl error:', error.message);
    return null;
  }
  return data?.signedUrl ?? null;
}
