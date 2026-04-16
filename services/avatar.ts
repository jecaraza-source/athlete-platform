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
 * Returns { url, error }:
 *   url   – stable public URL on success, null on failure
 *   error – human-readable error message (empty string on success)
 *
 * Why XHR instead of fetch()?
 *   On Android, local file:// / content:// URIs returned by
 *   expo-image-picker can have status 0 (non-ok) in fetch() even when
 *   the body is perfectly valid. XHR with responseType='blob' works
 *   reliably on both platforms.
 *
 * Why Blob instead of ArrayBuffer?
 *   Supabase JS v2 internally calls fetch() to upload. Passing a Blob
 *   directly is more reliably handled by the RN fetch polyfill than
 *   passing a raw ArrayBuffer.
 */
export async function uploadMobileAvatar(
  localUri:   string,
  authUserId: string,
  profileId:  string,
): Promise<{ url: string | null; error: string }> {
  try {
    // 1. Read the local image as a Uint8Array via XHR
    //    (avoids response.ok=false for local URIs on Android,
    //     and avoids "Network request failed" when using RN Blobs in fetch)
    const bytes = await readFileAsUint8Array(localUri);

    // 2. Upload to storage (upsert overwrites any existing photo)
    //    Uint8Array is an ArrayBufferView — handled natively by the
    //    React Native fetch polyfill without throwing.
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

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Reads a local file URI (file:// or content://) as a Uint8Array
 * using XMLHttpRequest with responseType 'arraybuffer'.
 *
 * Why Uint8Array (not Blob)?
 *   When a React Native XHR Blob is passed as the body of fetch(),
 *   the RN fetch polyfill cannot serialize it correctly and throws
 *   "Network request failed". Passing a Uint8Array (an ArrayBufferView)
 *   is handled natively and avoids this issue.
 *
 * Why XHR instead of fetch()?
 *   On Android, local file:// / content:// URIs from expo-image-picker
 *   can return status 0 in fetch(), making response.ok == false even
 *   though the data is valid. XHR is more reliable for local URIs.
 */
function readFileAsUint8Array(uri: string): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.responseType = 'arraybuffer';
    xhr.onload = () => {
      if (xhr.response) {
        resolve(new Uint8Array(xhr.response as ArrayBuffer));
      } else {
        reject(new Error('No se pudo leer el archivo (XHR sin respuesta)'));
      }
    };
    xhr.onerror = () => reject(new Error('No se pudo leer el archivo de imagen'));
    xhr.ontimeout = () => reject(new Error('Tiempo de espera agotado al leer la imagen'));
    xhr.open('GET', uri, true);
    xhr.send(null);
  });
}

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
