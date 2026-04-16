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
 * Uploads a JPEG image to the avatars bucket for the current user.
 *
 * @param localUri    - Local file URI from expo-image-picker (file:// or content://)
 * @param authUserId  - Supabase auth.uid() — becomes the folder name in storage
 * @param profileId   - profiles.id — used to update profiles.avatar_url
 * @returns The public avatar URL on success, null on failure
 */
export async function uploadMobileAvatar(
  localUri:   string,
  authUserId: string,
  profileId:  string,
): Promise<string | null> {
  try {
    // 1. Fetch the image as an ArrayBuffer from the local URI
    const response = await fetch(localUri);
    if (!response.ok) return null;
    const arrayBuffer = await response.arrayBuffer();

    // 2. Upload to storage (upsert overwrites any existing photo)
    const path = `${authUserId}/avatar.jpg`;
    const { error: uploadErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, arrayBuffer, {
        contentType: 'image/jpeg',
        upsert:      true,
      });

    if (uploadErr) {
      console.warn('[avatar] upload error:', uploadErr.message);
      return null;
    }

    // 3. Derive the public URL (bucket is public, no signature needed)
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
    }

    return publicUrl;
  } catch (e) {
    console.warn('[avatar] uploadMobileAvatar error:', e);
    return null;
  }
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
