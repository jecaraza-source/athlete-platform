// =============================================================================
// lib/notifications/providers/email-provider.ts
// Abstract interface for email sending providers.
// Swap adapters by implementing this interface and updating resend-adapter.ts.
// =============================================================================

import type { EmailSendResult } from '../types';

export interface SendEmailParams {
  to:         string;
  from:       string;
  subject:    string;
  html:       string;
  text:       string;
  /** Used for idempotency — provider should deduplicate on this when supported. */
  idempotency_key?: string;
}

export interface EmailProvider {
  /**
   * Send a single transactional email.
   * Must never throw — return a result with success: false instead.
   */
  send(params: SendEmailParams): Promise<EmailSendResult>;
}
