// =============================================================================
// lib/notifications/providers/onesignal-adapter.ts
// OneSignal push adapter. Calls the OneSignal v1 REST API directly.
// Provider docs: https://documentation.onesignal.com/reference/create-notification
// =============================================================================

import type { PushProvider, SendPushParams } from './push-provider';
import type { PushSendResult } from '../types';

const ONESIGNAL_API_URL = 'https://onesignal.com/api/v1/notifications';

export class OneSignalPushAdapter implements PushProvider {
  async send(params: SendPushParams): Promise<PushSendResult> {
    const appId  = process.env.ONESIGNAL_APP_ID;
    const apiKey = process.env.ONESIGNAL_REST_API_KEY;

    if (!appId || !apiKey) {
      return {
        success:         false,
        notification_id: null,
        error:           'ONESIGNAL_APP_ID or ONESIGNAL_REST_API_KEY is not set.',
        raw:             {},
      };
    }

    try {
      const body: Record<string, unknown> = {
        app_id:             appId,
        include_player_ids: params.player_ids,
        headings:           { en: params.title },
        contents:           { en: params.message },
      };

      if (params.deep_link) {
        body.url = params.deep_link;
      }

      if (params.extra_data && Object.keys(params.extra_data).length > 0) {
        body.data = params.extra_data;
      }

      if (params.idempotency_key) {
        // OneSignal supports external_id for deduplication
        body.external_id = params.idempotency_key;
      }

      const response = await fetch(ONESIGNAL_API_URL, {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Basic ${apiKey}`,
        },
        body: JSON.stringify(body),
      });

      const json = (await response.json()) as Record<string, unknown>;

      if (!response.ok) {
        return {
          success:         false,
          notification_id: null,
          error:           (json.errors as string[] | undefined)?.[0] ?? `HTTP ${response.status}`,
          raw:             json,
        };
      }

      return {
        success:         true,
        notification_id: (json.id as string) ?? null,
        error:           null,
        raw:             json,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        success:         false,
        notification_id: null,
        error:           message,
        raw:             { exception: message },
      };
    }
  }
}

/** Singleton export. */
export const oneSignalAdapter = new OneSignalPushAdapter();
