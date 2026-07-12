'use server';

/**
 * Avatar server actions
 *
 * Storage path: avatars/{authUserId}/avatar.{ext}
 * Bucket:       avatars  (public — no signed URLs needed)
 *
 * The web uses supabaseAdmin (bypasses storage RLS) so no storage
 * policies are required for the server-side upload path.
 * Mobile uploads go through the authenticated client and need the
 * RLS policies defined in migration 022.
 */

import { revalidatePath }         from 'next/cache';
import { supabaseAdmin }          from '@/lib/supabase-admin';
import { requireAuthenticated }   from '@/lib/rbac/server';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BUCKET      = 'avatars';
const MAX_BYTES   = 5 * 1024 * 1024; // 5 MB
const ALLOWED     = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const EXT_MAP: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png':  'png',
  'image/webp': 'webp',
  'image/gif':  'gif',
};

// ---------------------------------------------------------------------------
// uploadAvatar
// ---------------------------------------------------------------------------

/**
 * Uploads a profile photo for the currently authenticated user.
 *
 * - Accepts JPEG, PNG, WebP or GIF up to 5 MB.
 * - Stored at avatars/{authUserId}/avatar.{ext} (upsert — replaces any
 *   previously uploaded photo for that user).
 * - Persists the public URL to profiles.avatar_url.
 *
 * Returns { error, avatarUrl } — avatarUrl includes a ?t= cache-buster
 * so the browser re-downloads the new image immediately.
 */
export async function uploadAvatar(
  formData: FormData,
): Promise<{ error: string | null; avatarUrl: string | null }> {
  const user = await requireAuthenticated();
  if (!user.profile) return { error: 'Perfil no encontrado.', avatarUrl: null };

  const file = formData.get('avatar') as File | null;

  if (!file || file.size === 0) {
    return { error: 'No se seleccionó ningún archivo.', avatarUrl: null };
  }
  if (!ALLOWED.has(file.type)) {
    return { error: 'Solo se permiten imágenes JPEG, PNG, WebP o GIF.', avatarUrl: null };
  }
  if (file.size > MAX_BYTES) {
    return { error: 'La imagen no puede superar 5 MB.', avatarUrl: null };
  }

  const ext  = EXT_MAP[file.type] ?? 'jpg';
  const path = `${user.authUserId}/avatar.${ext}`;

  // Upload (upsert = true overwrites any existing file at this path)
  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: uploadErr } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: file.type, upsert: true });

  if (uploadErr) return { error: uploadErr.message, avatarUrl: null };

  // Derive stable public URL
  const { data: { publicUrl } } = supabaseAdmin.storage
    .from(BUCKET)
    .getPublicUrl(path);

  // Persist to profiles table
  await supabaseAdmin
    .from('profiles')
    .update({ avatar_url: publicUrl })
    .eq('id', user.profile.id);

  // Revalidate layout so AppShell reflects the new avatar immediately
  revalidatePath('/', 'layout');

  // Return URL with cache-buster so the browser fetches the new image
  return { error: null, avatarUrl: `${publicUrl}?t=${Date.now()}` };
}

// ---------------------------------------------------------------------------
// deleteAvatar
// ---------------------------------------------------------------------------

/**
 * Removes the profile photo for the currently authenticated user.
 * Tries all possible extensions (the user may have changed format before).
 */
export async function deleteAvatar(): Promise<{ error: string | null }> {
  const user = await requireAuthenticated();
  if (!user.profile) return { error: 'Perfil no encontrado.' };

  // Delete any file that might exist under this user's folder
  const paths = ['jpg', 'png', 'webp', 'gif'].map(
    (ext) => `${user.authUserId}/avatar.${ext}`
  );
  await supabaseAdmin.storage.from(BUCKET).remove(paths);

  // Clear the stored URL
  await supabaseAdmin
    .from('profiles')
    .update({ avatar_url: null })
    .eq('id', user.profile.id);

  revalidatePath('/', 'layout');
  return { error: null };
}
