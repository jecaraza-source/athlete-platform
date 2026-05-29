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

    if (i === 0) firstId = (json.id as string) ?? null;
    totalRecipients += batch.length;
  }

  return {
    success:        true,
    onesignalId:    firstId,
    recipientCount: totalRecipients,
    error:          null,
  };
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
