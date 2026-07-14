// =============================================================================
// lib/newsletter/onesignal.ts
// OneSignal integration for the newsletter system:
//   1. sendNewsletterViaOneSignal — email delivery to subscriber list
//   2. notifyAdminsNewsletterReady — push notification to staff roles
//
// Uses ONESIGNAL_APP_ID + ONESIGNAL_REST_API_KEY env vars (same keys as
// the existing push-service.ts / onesignal-adapter.ts).
// =============================================================================

import 'server-only';

const ONESIGNAL_API_URL = 'https://onesignal.com/api/v1/notifications';

function getCredentials(): { appId: string; apiKey: string } | null {
  const appId  = process.env.ONESIGNAL_APP_ID;
  const apiKey = process.env.ONESIGNAL_REST_API_KEY;
  if (!appId || !apiKey) return null;
  return { appId, apiKey };
}

// ---------------------------------------------------------------------------
// Email newsletter delivery
// ---------------------------------------------------------------------------

export type SendNewsletterParams = {
  asunto:       string;
  previewText:  string;
  htmlContent:  string;
  externalIds:  string[];   // profiles.id UUIDs registered as OneSignal external_id
};

export type NewsletterSendResult = {
  success:         boolean;
  onesignalId:     string | null;
  recipientCount:  number;
  error:           string | null;
};

/**
 * Sends an HTML email newsletter to a list of subscribers via OneSignal's
 * Email channel. Each subscriber must have a OneSignal external_id matching
 * their profiles.id UUID (set via OneSignal.login(profile.id) on mobile).
 *
 * OneSignal Email API docs:
 * https://documentation.onesignal.com/reference/create-notification#email-channel
 */
export async function sendNewsletterViaOneSignal(
  params: SendNewsletterParams
): Promise<NewsletterSendResult> {
  const creds = getCredentials();
  if (!creds) {
    return {
      success:        false,
      onesignalId:    null,
      recipientCount: 0,
      error:          'ONESIGNAL_APP_ID or ONESIGNAL_REST_API_KEY is not set.',
    };
  }

  if (params.externalIds.length === 0) {
    return { success: true, onesignalId: null, recipientCount: 0, error: null };
  }

  // OneSignal limits include_external_user_ids to 2,000 per request.
  // For larger lists we send in batches and return the first notification id.
  const BATCH = 2000;
  let firstId:        string | null = null;
  let totalRecipients = 0;

  for (let i = 0; i < params.externalIds.length; i += BATCH) {
    const batch = params.externalIds.slice(i, i + BATCH);

    const body = {
      app_id:                         creds.appId,
      include_external_user_ids:      batch,
      channel_for_external_user_ids:  'email',
      email_subject:                  params.asunto,
      email_preheader:                params.previewText,
      email_body:                     params.htmlContent,
    };

    const res = await fetch(ONESIGNAL_API_URL, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Basic ${creds.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    const json = (await res.json()) as Record<string, unknown>;

    if (!res.ok) {
      const msg = (json.errors as string[] | undefined)?.[0] ?? `HTTP ${res.status}`;
      return { success: false, onesignalId: firstId, recipientCount: totalRecipients, error: msg };
    }

    const notifId = (json.id as string | undefined) ?? '';

    // OneSignal returns HTTP 200 with id='' when no subscribers are registered.
    // Surface this as a recoverable warning so callers can log it clearly.
    if (notifId === '' && Array.isArray(json.errors) && (json.errors as string[]).length > 0) {
      const msg = (json.errors as string[])[0];
      console.warn('[sendNewsletterViaOneSignal] OneSignal warning:', msg);
      // Still count the batch as attempted; caller decides how to handle
      return {
        success:        false,
        onesignalId:    null,
        recipientCount: 0,
        error:          `OneSignal: ${msg} — verifica que los usuarios estén registrados como suscriptores de email en OneSignal.`,
      };
    }

    if (i === 0) firstId = notifId || null;
    // Use OneSignal's reported recipient count when available (more accurate
    // than batch.length, which includes IDs that may not be registered)
    const reported = typeof json.recipients === 'number' ? json.recipients : batch.length;
    totalRecipients += reported;
  }

  return {
    success:        true,
    onesignalId:    firstId,
    recipientCount: totalRecipients,
    error:          null,
  };
}

// ---------------------------------------------------------------------------
// Push notification: newsletter published (subscriber delivery)
// ---------------------------------------------------------------------------

export type SendNewsletterPushParams = {
  asunto:      string;
  preview:     string;
  externalIds: string[];
  draftId:     string;
};

/**
 * Sends a native push notification to subscriber devices announcing a new
 * newsletter edition. Uses OneSignal's push channel with external_id targeting
 * (same IDs registered via OneSignal.login(profile.id) on mobile).
 *
 * Best-effort: callers should wrap in try/catch and not fail on push errors.
 */
export async function sendNewsletterPush(
  params: SendNewsletterPushParams
): Promise<{ success: boolean; error: string | null }> {
  const creds = getCredentials();
  if (!creds) return { success: false, error: 'Missing OneSignal credentials' };
  if (params.externalIds.length === 0) return { success: true, error: null };

  const body = {
    app_id:                        creds.appId,
    include_external_user_ids:     params.externalIds,
    channel_for_external_user_ids: 'push',
    headings: { en: params.asunto,  es: params.asunto },
    contents: { en: params.preview, es: params.preview },
    data: {
      type:     'newsletter_ready',
      draft_id: params.draftId,
    },
  };

  const res = await fetch(ONESIGNAL_API_URL, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Basic ${creds.apiKey}`,
    },
    body: JSON.stringify(body),
  });

  const json = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    const msg = (json.errors as string[] | undefined)?.[0] ?? `HTTP ${res.status}`;
    return { success: false, error: msg };
  }
  return { success: true, error: null };
}

// ---------------------------------------------------------------------------
// Admin push notification (newsletter ready for approval)
// ---------------------------------------------------------------------------

/**
 * Sends a push notification to all users with role tag = 'staff' via
 * OneSignal segment/tag filtering.
 *
 * The mobile hook sets tag { role: 'staff' } for all non-athlete profiles
 * (see apps/mobile/hooks/use-push-notifications.ts).
 */
export async function notifyAdminsNewsletterReady(
  pendingCount: number
): Promise<void> {
  const creds = getCredentials();
  if (!creds) return;

  const body = {
    app_id: creds.appId,
    filters: [
      { field: 'tag', key: 'role', relation: '=', value: 'staff' },
    ],
    headings: { en: '📧 Newsletter listo para revisar', es: '📧 Newsletter listo para revisar' },
    contents: {
      en: `Hay ${pendingCount} newsletter(s) pendiente(s) de aprobación para hoy`,
      es: `Hay ${pendingCount} newsletter(s) pendiente(s) de aprobación para hoy`,
    },
    data: {
      type:      'newsletter_approval',
      deep_link: '/app/newsletter',
    },
    url: '/app/newsletter',
  };

  try {
    await fetch(ONESIGNAL_API_URL, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Basic ${creds.apiKey}`,
      },
      body: JSON.stringify(body),
    });
  } catch {
    // Best-effort — cron continues even if push fails
  }
}

// ---------------------------------------------------------------------------
// User push notification (newsletter published)
// ---------------------------------------------------------------------------

/**
 * Alerts mobile users via push as soon as a newsletter is sent, instead of
 * relying on them to reopen the app and discover it.
 *
 * Targets the same profile IDs already resolved for the email send (via
 * OneSignal external_id, set by OneSignal.login(profile.id) in
 * apps/mobile/hooks/use-push-notifications.ts), so push and email audiences
 * always match exactly — no separate segment/tag logic to keep in sync.
 */
export async function notifyUsersNewsletterPublished(params: {
  draftId:     string;
  asunto:      string;
  externalIds: string[];
}): Promise<void> {
  const creds = getCredentials();
  if (!creds) return;
  if (params.externalIds.length === 0) return;

  const deepLink = `/app/newsletter/${params.draftId}`;

  // OneSignal limits include_external_user_ids to 2,000 per request.
  const BATCH = 2000;
  for (let i = 0; i < params.externalIds.length; i += BATCH) {
    const batch = params.externalIds.slice(i, i + BATCH);

    const body = {
      app_id: creds.appId,
      include_external_user_ids:      batch,
      channel_for_external_user_ids:  'push',   // explicit: skip email channel
      headings: { en: '📬 Nuevo newsletter disponible', es: '📬 Nuevo newsletter disponible' },
      contents: { en: params.asunto, es: params.asunto },
      data: {
        type:      'newsletter_published',
        deep_link: deepLink,
      },
      url: deepLink,
    };

    try {
      await fetch(ONESIGNAL_API_URL, {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Basic ${creds.apiKey}`,
        },
        body: JSON.stringify(body),
      });
    } catch {
      // Best-effort — the newsletter is already sent; push failure shouldn't roll that back
    }
  }
}
