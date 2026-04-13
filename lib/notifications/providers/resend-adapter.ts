// =============================================================================
// lib/notifications/providers/resend-adapter.ts
// Resend email adapter. Implements the EmailProvider interface.
// Provider docs: https://resend.com/docs/api-reference/emails/send-email
// =============================================================================

import { Resend } from 'resend';
import type { EmailProvider, SendEmailParams } from './email-provider';
import type { EmailSendResult } from '../types';

// Singleton — one Resend client per process lifetime.
let _resend: Resend | null = null;

function getResendClient(): Resend {
  if (!_resend) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error('RESEND_API_KEY environment variable is not set.');
    }
    _resend = new Resend(apiKey);
  }
  return _resend;
}

export class ResendEmailAdapter implements EmailProvider {
  async send(params: SendEmailParams): Promise<EmailSendResult> {
    try {
      const client = getResendClient();

      const { data, error } = await client.emails.send({
        from:    params.from,
        to:      [params.to],
        subject: params.subject,
        html:    params.html,
        text:    params.text,
        // Resend supports idempotency headers but does not expose the option
        // directly in its Node SDK payload; use headers if needed in future.
      });

      if (error) {
        return {
          success:    false,
          message_id: null,
          error:      error.message,
          raw:        error as unknown as Record<string, unknown>,
        };
      }

      return {
        success:    true,
        message_id: data?.id ?? null,
        error:      null,
        raw:        data as unknown as Record<string, unknown>,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        success:    false,
        message_id: null,
        error:      message,
        raw:        { exception: message },
      };
    }
  }
}

/** Singleton export — import this anywhere you need to send email. */
export const resendAdapter = new ResendEmailAdapter();
