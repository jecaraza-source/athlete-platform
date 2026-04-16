// =============================================================================
// services/avatar.ts
// Upload and delete avatar photos for the mobile app.
//
// Storage path: avatars/{authUserId}/avatar.jpg
// Bucket is PUBLIC — no signed URL needed for display.
//
// Upload uses the authenticated Supabase client so the RLS policies in
// migration 022 apply:
//   CREATE POLICY "Users can upload their own avatar"
//   ON storage.objects FOR INSERT TO authenticated
//   WITH CHECK (bucket_id = 'avatars' AND foldername[1] = auth.uid()::text)
// =============================================================================

import { supabase } from '@/lib/supabase';

const BUCKET = 'avatars';

// ---------------------------------------------------------------------------
// uploadAvatar
// ---------------------------------------------------------------------------

/**
 * Uploads a profile photo for the current user.
 *
 * Accepts a raw base64 string from expo-image-picker's { base64: true }
 * option. This completely avoids file URI access issues on Android
 * (which block XHR / fetch reads of local file:// and content:// URIs).
 *
 * Conversion: base64 → Uint8Array via atob() (available in Hermes).
 * Supabase storage upload receives the Uint8Array (an ArrayBufferView),
 * which the React Native fetch polyfill handles natively.
 *
 * Returns { url, error }:
 *   url   – stable public URL on success, null on failure
 *   error – human-readable error message (empty string on success)
 */
export async function uploadMobileAvatar(
  base64Data: string,  // raw base64 string from expo-image-picker
  authUserId: string,
  profileId:  string,
): Promise<{ url: string | null; error: string }> {
  try {
    // 1. Decode base64 → Uint8Array (atob is global in Hermes / React Native)
    const binaryStr = atob(base64Data);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    // 2. Upload to storage (upsert = true replaces existing avatar)
    const path = `${authUserId}/avatar.jpg`;
    const { error: uploadErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, bytes, {
        contentType: 'image/jpeg',
        upsert:      true,
      });

    if (uploadErr) {
      const msg = translateStorageError(uploadErr.message);
      console.warn('[avatar] upload error:', uploadErr.message);
      return { url: null, error: msg };
    }

    // 3. Derive the public URL (bucket is public — no signature needed)
    const { data: { publicUrl } } = supabase.storage
      .from(BUCKET)
      .getPublicUrl(path);

    // 4. Persist to profiles table
    const { error: updateErr } = await supabase
      .from('profiles')
      .update({ avatar_url: publicUrl })
      .eq('id', profileId);

    if (updateErr) {
      console.warn('[avatar] profiles update error:', updateErr.message);
      // Non-fatal: the file is in storage, just the DB update failed.
      // Return success so the UI shows the new photo.
    }

    return { url: publicUrl, error: '' };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn('[avatar] uploadMobileAvatar exception:', msg);
    return { url: null, error: msg };
  }
}

// (no internal helpers needed — base64 decoding uses the global atob())

/**
 * Translates common Supabase storage error messages into Spanish.
 * Keeps the original message as fallback so it’s still useful for debugging.
 */
function translateStorageError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('bucket not found') || m.includes('not found')) {
    return 'El bucket de almacenamiento no existe. Aplica la migracíon 022_avatar.sql en Supabase.';
  }
  if (m.includes('row-level security') || m.includes('rls') || m.includes('policy')) {
    return 'Sin permiso para subir la foto. Verifica las políticas RLS del bucket avatars.';
  }
  if (m.includes('payload too large') || m.includes('size')) {
    return 'La imagen es demasiado grande. Máximo 5 MB.';
  }
  if (m.includes('invalid') && m.includes('token')) {
    return 'Sesión expirada. Cierra sesión y vuelve a entrar.';
  }
  return message;
}

// ---------------------------------------------------------------------------
// deleteMobileAvatar
// ---------------------------------------------------------------------------

/**
 * Removes the user's avatar from storage and clears profiles.avatar_url.
 */
export async function deleteMobileAvatar(
  authUserId: string,
  profileId:  string,
): Promise<boolean> {
  try {
    // Remove (best-effort — ignore "not found" errors)
    await supabase.storage
      .from(BUCKET)
      .remove([`${authUserId}/avatar.jpg`]);

    const { error } = await supabase
      .from('profiles')
      .update({ avatar_url: null })
      .eq('id', profileId);

    if (error) {
      console.warn('[avatar] delete error:', error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.warn('[avatar] deleteMobileAvatar error:', e);
    return false;
  }
}

// ---------------------------------------------------------------------------
// getCacheBustedUrl
// ---------------------------------------------------------------------------

/**
 * Appends a short timestamp segment to force the image to reload
 * after an upload (CDN / browser cache bypass).
 */
export function getCacheBustedUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}t=${Math.floor(Date.now() / 10000)}`; // refreshes every 10 s
}
