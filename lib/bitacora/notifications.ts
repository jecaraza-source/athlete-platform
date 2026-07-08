import 'server-only';
// =============================================================================
// lib/bitacora/notifications.ts
// Envía notificaciones push OneSignal al publicar actividades y ediciones.
// Marca notified_at para evitar reenvíos duplicados.
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase-admin';
import { getThumbnailUrl } from '@/lib/storage-config';

const ONESIGNAL_API_URL = 'https://onesignal.com/api/v1/notifications';
const SEGMENT           = 'Comunidad AO Deporte';
const APP_URL           = process.env.NEXT_PUBLIC_APP_URL ?? 'https://aodeporte.com';

interface OneSignalPayload {
  app_id:             string;
  included_segments:  string[];
  headings:           { en: string; es: string };
  contents:           { en: string; es: string };
  url?:               string;
  big_picture?:       string;
  android_big_picture?: string;
  ios_attachments?:   Record<string, string>;
  external_id?:       string;
}

async function sendOneSignalNotification(payload: OneSignalPayload): Promise<void> {
  const appId  = process.env.ONESIGNAL_APP_ID;
  const apiKey = process.env.ONESIGNAL_REST_API_KEY;

  if (!appId || !apiKey) {
    console.warn('[bitacora/notifications] ONESIGNAL_APP_ID o ONESIGNAL_REST_API_KEY no configuradas.');
    return;
  }

  try {
    const response = await fetch(ONESIGNAL_API_URL, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Basic ${apiKey}`,
      },
      body: JSON.stringify({ ...payload, app_id: appId }),
    });

    if (!response.ok) {
      const json = await response.json().catch(() => ({}));
      console.error('[bitacora/notifications] OneSignal error:', json);
    }
  } catch (err) {
    console.error('[bitacora/notifications] Error enviando push:', err);
  }
}

// ---------------------------------------------------------------------------
// Notificación: nueva actividad publicada
// ---------------------------------------------------------------------------

/**
 * Envía una notificación push al publicar una actividad.
 * Usa la primera foto featured como imagen adjunta.
 * Marca `notified_at` en la actividad para evitar duplicados.
 */
export async function notifyActivityPublished(activityId: string): Promise<void> {
  const { data: activity } = await supabaseAdmin
    .from('activities')
    .select('id, slug, title, description, notified_at')
    .eq('id', activityId)
    .maybeSingle();

  if (!activity) return;
  if (activity.notified_at) return; // ya notificada

  // Obtener foto featured para la notificación
  const { data: photo } = await supabaseAdmin
    .from('activity_photos')
    .select('storage_path')
    .eq('activity_id', activityId)
    .eq('featured', true)
    .maybeSingle();

  const deepLink    = `${APP_URL}/bitacora/${activity.slug}`;
  const excerpt     = (activity.description ?? '').slice(0, 100).trim();
  const bodyText    = excerpt ? `${excerpt}…` : 'Toca para ver la actividad completa.';
  const imageUrl    = photo ? getThumbnailUrl(photo.storage_path) : undefined;

  const payload: OneSignalPayload = {
    app_id:            '',  // se completa en sendOneSignalNotification
    included_segments: [SEGMENT],
    headings:          { en: activity.title, es: activity.title },
    contents:          { en: bodyText,        es: bodyText },
    url:               deepLink,
    external_id:       `activity-published-${activityId}`,
  };

  if (imageUrl) {
    payload.big_picture           = imageUrl;
    payload.android_big_picture   = imageUrl;
    payload.ios_attachments       = { id1: imageUrl };
  }

  await sendOneSignalNotification(payload);

  // Marcar como notificada para evitar duplicados
  await supabaseAdmin
    .from('activities')
    .update({ notified_at: new Date().toISOString() })
    .eq('id', activityId);
}

// ---------------------------------------------------------------------------
// Notificación: nueva edición de la Revista publicada
// ---------------------------------------------------------------------------

/**
 * Envía una notificación push al publicar una edición de la Revista.
 * Marca `notified_at` en el magazine_issue para evitar duplicados.
 */
export async function notifyMagazineIssuePublished(
  issueId: string,
  title:   string
): Promise<void> {
  const { data: issue } = await supabaseAdmin
    .from('magazine_issues')
    .select('id, notified_at')
    .eq('id', issueId)
    .maybeSingle();

  if (!issue) return;
  if (issue.notified_at) return; // ya notificada

  const deepLink  = `${APP_URL}/revista/${issueId}`;
  const bodyText  = 'La nueva edición de la Revista AO Deporte ya está disponible. ¡No te la pierdas!';

  const payload: OneSignalPayload = {
    app_id:            '',
    included_segments: [SEGMENT],
    headings:          { en: title,    es: title },
    contents:          { en: bodyText, es: bodyText },
    url:               deepLink,
    external_id:       `magazine-published-${issueId}`,
  };

  await sendOneSignalNotification(payload);

  await supabaseAdmin
    .from('magazine_issues')
    .update({ notified_at: new Date().toISOString() })
    .eq('id', issueId);
}
