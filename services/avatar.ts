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

// The deployed web app URL.  Override via EXPO_PUBLIC_WEB_URL for local dev.
const WEB_URL =
  (process.env.EXPO_PUBLIC_WEB_URL ?? 'https://www.aodeporte.com').replace(/\/$/, '');

// ---------------------------------------------------------------------------
// uploadMobileAvatar
// ---------------------------------------------------------------------------

/**
 * Uploads a profile photo by proxying through the web API.
 *
 * Accepts the raw base64 string from expo-image-picker { base64: true }.
 * Sends it to POST /api/avatar/upload together with the user's JWT so the
 * server can validate the request and upload using supabaseAdmin.
 *
 * Returns { url, error }.
 */
export async function uploadMobileAvatar(
  base64Data: string,
  _authUserId: string,  // kept for API compatibility; server derives from JWT
  profileId:  string,
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

    // 2. POST to the web proxy endpoint
    const response = await fetch(`${WEB_URL}/api/avatar/upload`, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ base64: base64Data, profileId }),
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
  return `${url}${sep}t=${Math.floor(Date.now() / 10000)}`;
}
