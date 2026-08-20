// =============================================================================
// lib/notifications/providers/onesignal-adapter.ts
// OneSignal push adapter. Calls the OneSignal v1 REST API directly.
// Provider docs: https://documentation.onesignal.com/reference/create-notification
// =============================================================================

import { createHash } from 'node:crypto';

import type { PushProvider, SendPushParams } from './push-provider';
import type { PushSendResult } from '../types';

const ONESIGNAL_API_URL = 'https://onesignal.com/api/v1/notifications';

// Fixed namespace for deriving deterministic UUIDs from our idempotency keys
// (arbitrary, just needs to stay constant so the same key always maps to the
// same UUID).
const IDEMPOTENCY_NAMESPACE = '4b6f1c2a-8e2f-4b0a-9c1a-6a3f2e7d9b10';

/**
 * OneSignal's notification `external_id` (used for idempotency) must be a
 * UUID — our idempotency keys are compound strings like
 * "plan:<uuid>:profile:<uuid>:token:<uuid>", so derive a UUID v5 from the key
 * instead. Same input always produces the same output, preserving true
 * idempotency across retries.
 */
function idempotencyKeyToUuid(key: string): string {
  const namespaceBytes = Buffer.from(IDEMPOTENCY_NAMESPACE.replace(/-/g, ''), 'hex');
  const hash = createHash('sha1')
    .update(Buffer.concat([namespaceBytes, Buffer.from(key, 'utf8')]))
    .digest();
  const bytes = hash.subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50; // version 5
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

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
        include_subscription_ids: params.player_ids,
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
        // OneSignal supports external_id for deduplication, but requires it
        // to be a UUID — our idempotency keys aren't, so derive one.
        body.external_id = idempotencyKeyToUuid(params.idempotency_key);
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
