// =============================================================================
// lib/notifications/providers/push-provider.ts
// Abstract interface for push notification providers (OneSignal, FCM, etc.).
// =============================================================================

import type { PushSendResult } from '../types';

export interface SendPushParams {
  /** OneSignal player IDs or equivalent subscription identifiers. */
  player_ids:        string[];
  title:             string;
  message:           string;
  deep_link?:        string;
  extra_data?:       Record<string, unknown>;
  idempotency_key?:  string;
}

export interface PushProvider {
  /**
   * Send a push notification to one or more device subscriptions.
   * Must never throw — return a result with success: false instead.
   */
  send(params: SendPushParams): Promise<PushSendResult>;
}
