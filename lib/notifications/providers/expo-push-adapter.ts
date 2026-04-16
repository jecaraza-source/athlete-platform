// =============================================================================
// lib/notifications/providers/expo-push-adapter.ts
// Expo Push API adapter. Sends push notifications to devices registered via
// expo-notifications (Expo Go and standalone builds without OneSignal SDK).
//
// Docs: https://docs.expo.dev/push-notifications/sending-notifications/
// Tokens look like: ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]
// =============================================================================

import type { PushProvider, SendPushParams } from './push-provider';
import type { PushSendResult } from '../types';

const EXPO_PUSH_API = 'https://exp.host/--/api/v2/push/send';

/** Returns true when the token string is an Expo push token. */
export function isExpoToken(token: string): boolean {
  return token.startsWith('ExponentPushToken[') || token.startsWith('ExpoPushToken[');
}

export class ExpoPushAdapter implements PushProvider {
  async send(params: SendPushParams): Promise<PushSendResult> {
    // params.player_ids contains the Expo push token(s)
    const messages = params.player_ids.map((to) => {
      const msg: Record<string, unknown> = {
        to,
        title: params.title,
        body:  params.message,
        sound: 'default',
        // Android notification channel (must match the channel created in the app)
        channelId: 'default',
      };

      if (params.deep_link) {
        // Stored in data so the notification response listener can handle it
        msg.data = { deep_link: params.deep_link, ...(params.extra_data ?? {}) };
      } else if (params.extra_data && Object.keys(params.extra_data).length > 0) {
        msg.data = params.extra_data;
      }

      return msg;
    });

    try {
      const response = await fetch(EXPO_PUSH_API, {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Accept':        'application/json',
          'Accept-Encoding': 'gzip, deflate',
        },
        body: JSON.stringify(messages.length === 1 ? messages[0] : messages),
      });

      const json = (await response.json()) as Record<string, unknown>;

      if (!response.ok) {
        return {
          success:         false,
          notification_id: null,
          error:           (json.message as string | undefined) ?? `HTTP ${response.status}`,
          raw:             json,
        };
      }

      // Expo returns: { data: [ { status: 'ok', id: '...' } | { status: 'error', message: '...' } ] }
      const results = (json.data as Array<Record<string, unknown>> | undefined) ?? [];
      const first   = results[0];

      if (!first || first.status === 'error') {
        const errMsg =
          (first?.message as string | undefined) ??
          (first?.details as Record<string, string> | undefined)?.error ??
          'Unknown Expo push error';

        return {
          success:         false,
          notification_id: null,
          error:           errMsg,
          raw:             json,
        };
      }

      return {
        success:         true,
        notification_id: (first.id as string) ?? null,
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
export const expoPushAdapter = new ExpoPushAdapter();
