// =============================================================================
// services/avatar.ts
// Upload and delete avatar photos for the mobile app.
//
// ARCHITECTURE: Uploads are proxied through the web app's API endpoint
// (POST /api/avatar/upload) rather than going directly to Supabase Storage.
//
// WHY?
//   The mobile Supabase client uses the anon key. Storage RLS policies can be
//   difficult to configure correctly for mobile clients, and the exact policy
//   evaluation differs between Supabase versions. By routing through the web
//   backend, we use supabaseAdmin (service-role) which bypasses RLS entirely.
//
// SECURITY:
//   The API endpoint validates the caller's JWT before accepting the upload.
//   Only the profile owner can upload their own avatar.
// =============================================================================

import { supabase } from '@/lib/supabase';

// The deployed web app URL (Vercel).
// NOTE: www.aodeporte.com is a Squarespace marketing site and does NOT serve
// the Next.js app. The stable Vercel alias for the athlete platform is below.
// Override via EXPO_PUBLIC_WEB_URL in .env.local for local development.
const WEB_URL =
  (process.env.EXPO_PUBLIC_WEB_URL ?? 'https://athlete-platform-blush.vercel.app').replace(/\/$/, '');

// ---------------------------------------------------------------------------
// uploadMobileAvatar
// ---------------------------------------------------------------------------

/**
 * Uploads a profile photo by proxying through the web API.
 *
 * Accepts the local image URI from expo-image-picker and sends it as
 * multipart/form-data to POST /api/avatar/upload together with the user's
 * JWT so the server can validate the request and upload using supabaseAdmin.
 *
 * Using FormData avoids the base64 encoding overhead (~33% larger payload)
 * and the "Network request failed" errors on Android caused by sending large
 * base64 strings as a JSON body.
 *
 * Returns { url, error }.
 */
export async function uploadMobileAvatar(
  imageUri:    string,
  _authUserId: string,  // kept for API compatibility; server derives from JWT
  profileId:   string,
): Promise<{ url: string | null; error: string }> {
  try {
    // 1. Get the current session's access token
    const { data: { session } } = await supabase.auth.getSession();
    const accessToken = session?.access_token;

    if (!accessToken) {
      return {
        url:   null,
        error: 'No hay sesión activa. Cierra sesión y vuelve a entrar.',
      };
    }

    // 2. Build multipart/form-data payload.
    //    React Native treats { uri, name, type } as a file part; do NOT set
    //    Content-Type manually — fetch injects the correct multipart boundary.
    const formData = new FormData();
    formData.append('file', {
      uri:  imageUri,
      name: 'avatar.jpg',
      type: 'image/jpeg',
    } as unknown as Blob);
    formData.append('profileId', profileId);

    // 3. POST to the web proxy endpoint
    const response = await fetch(`${WEB_URL}/api/avatar/upload`, {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
      body: formData,
    });

    // 3. Parse the JSON response
    let result: { url?: string; error?: string };
    try {
      result = await response.json();
    } catch {
      return { url: null, error: `HTTP ${response.status}` };
    }

    if (!response.ok || result.error) {
      const msg = result.error ?? `HTTP ${response.status}`;
      console.warn('[avatar] proxy error:', msg);
      return { url: null, error: msg };
    }

    return { url: result.url ?? null, error: '' };

  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn('[avatar] uploadMobileAvatar exception:', msg);
    return { url: null, error: msg };
  }
}

// ---------------------------------------------------------------------------
// deleteMobileAvatar
// ---------------------------------------------------------------------------

/**
 * Clears profiles.avatar_url (storage cleanup is handled server-side on
 * the next upload via upsert).  Uses the authenticated Supabase client
 * since profiles UPDATE doesn’t require special permissions.
 */
export async function deleteMobileAvatar(
  _authUserId: string,
  profileId:   string,
): Promise<boolean> {
  try {
    // Verify session before updating
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    // The .eq('auth_user_id', user.id) ensures only the owner can clear their
    // own avatar; the UPDATE is a no-op if profileId belongs to someone else.
    const { error } = await supabase
      .from('profiles')
      .update({ avatar_url: null })
      .eq('id', profileId)
      .eq('auth_user_id', user.id); // ownership guard

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
  return `${url}${sep}t=${Math.floor(Date.now() / 10000)}`;
}
