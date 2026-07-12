'use server';

import { randomUUID }      from 'crypto';
import { revalidatePath }  from 'next/cache';
import { supabaseAdmin }   from '@/lib/supabase-admin';
import { assertAdminAccess, getCurrentUser } from '@/lib/rbac/server';

// =============================================================================
// Types
// =============================================================================

export type Protocol = {
  id:          string;
  discipline:  string;
  title:       string | null;
  version:     string | null;
  file_path:   string;
  file_name:   string;
  file_size:   number | null;
  uploaded_by: string | null;
  created_at:  string;
  updated_at:  string;
};

export type DisciplineKey = 'coach' | 'physio' | 'medic' | 'nutrition' | 'psychology';

const BUCKET   = 'protocols';
const MAX_SIZE = 50 * 1024 * 1024; // 50 MB

/**
 * Creates the 'protocols' bucket if it doesn't already exist.
 * Safe to call multiple times — Supabase returns an error for duplicate bucket
 * names which we intentionally ignore.
 */
async function ensureBucket(): Promise<void> {
  await supabaseAdmin.storage.createBucket(BUCKET, {
    public:        false,
    fileSizeLimit: MAX_SIZE,
    allowedMimeTypes: ['application/pdf'],
  });
  // Ignore the error — it just means the bucket already exists.
}

// =============================================================================
// Queries (read — no auth guard needed; middleware + page guards handle access)
// =============================================================================

/** Returns all protocol rows ordered by discipline. */
export async function getAllProtocols(): Promise<Protocol[]> {
  const { data, error } = await supabaseAdmin
    .from('protocols')
    .select('*')
    .order('discipline');
  if (error) {
    // Silently return empty when the table hasn't been migrated yet
    const isMissing = error.message?.includes('protocols') || error.message?.includes('schema cache');
    if (!isMissing) console.error('[protocols] getAllProtocols:', error.message);
    return [];
  }
  return (data ?? []) as Protocol[];
}

/** Returns the protocol for one discipline, or null if none has been uploaded. */
export async function getProtocolByDiscipline(
  discipline: DisciplineKey
): Promise<Protocol | null> {
  const { data, error } = await supabaseAdmin
    .from('protocols')
    .select('*')
    .eq('discipline', discipline)
    .maybeSingle();
  if (error) {
    const isMissing = error.message?.includes('protocols') || error.message?.includes('schema cache');
    if (!isMissing) console.error('[protocols] getProtocolByDiscipline:', error.message);
    return null;
  }
  return data as Protocol | null;
}

/**
 * Creates a signed URL (valid 1 hour) for a protocol file.
 * Safe to call from Server Components / Actions — uses the service-role client.
 */
export async function getProtocolSignedUrl(
  filePath: string
): Promise<string | null> {
  const { data } = await supabaseAdmin.storage
    .from(BUCKET)
    .createSignedUrl(filePath, 60 * 60);
  return data?.signedUrl ?? null;
}

// =============================================================================
// Mutations — admin only
// =============================================================================

/**
 * Uploads a PDF for a discipline. Replaces the existing file if any.
 * Requires admin access.
 */
export async function uploadProtocol(
  discipline: DisciplineKey,
  formData: FormData
): Promise<{ error: string | null }> {
  const denied = await assertAdminAccess();
  if (denied) return denied;

  const currentUser = await getCurrentUser();

  const file = formData.get('file') as File | null;
  if (!file || file.size === 0) {
    return { error: 'No se seleccionó ningún archivo.' };
  }
  if (file.type !== 'application/pdf') {
    return { error: 'Solo se permiten archivos PDF.' };
  }
  if (file.size > MAX_SIZE) {
    return { error: `El archivo excede el límite de 50 MB (${(file.size / 1024 / 1024).toFixed(1)} MB).` };
  }

  const title   = (formData.get('title')   as string | null)?.trim() || null;
  const version = (formData.get('version') as string | null)?.trim() || null;

  // ── Ensure the storage bucket exists ───────────────────────────────────
  await ensureBucket();

  // ── Remove old file from storage if one exists ──────────────────────────
  const existing = await getProtocolByDiscipline(discipline);
  if (existing?.file_path) {
    await supabaseAdmin.storage.from(BUCKET).remove([existing.file_path]);
  }

  // ── Upload new PDF ───────────────────────────────────────────────────────
  const filePath = `${discipline}/${randomUUID()}.pdf`;
  const buffer   = Buffer.from(await file.arrayBuffer());

  const { error: uploadErr } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(filePath, buffer, {
      contentType: 'application/pdf',
      upsert: false,
    });

  if (uploadErr) return { error: uploadErr.message };

  // ── Upsert DB record (one row per discipline) ────────────────────────────
  const { error: dbErr } = await supabaseAdmin
    .from('protocols')
    .upsert(
      {
        discipline,
        title:       title ?? `Protocolo ${discipline}`,
        version,
        file_path:   filePath,
        file_name:   file.name,
        file_size:   file.size,
        uploaded_by: currentUser?.profile?.id ?? null,
        updated_at:  new Date().toISOString(),
      },
      { onConflict: 'discipline' }
    );

  if (dbErr) {
    // Rollback: remove the just-uploaded file
    await supabaseAdmin.storage.from(BUCKET).remove([filePath]);
    return { error: dbErr.message };
  }

  revalidatePath('/protocols', 'layout');
  revalidatePath('/admin/protocols');
  return { error: null };
}

/**
 * Permanently deletes a protocol (file + DB row).
 * Requires admin access.
 */
export async function deleteProtocol(
  id: string,
  filePath: string
): Promise<{ error: string | null }> {
  const denied = await assertAdminAccess();
  if (denied) return denied;

  // Storage first — even if DB delete fails the file is gone
  await supabaseAdmin.storage.from(BUCKET).remove([filePath]);

  const { error } = await supabaseAdmin
    .from('protocols')
    .delete()
    .eq('id', id);

  if (error) return { error: error.message };

  revalidatePath('/protocols', 'layout');
  revalidatePath('/admin/protocols');
  return { error: null };
}
