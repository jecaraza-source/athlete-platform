// =============================================================================
// lib/newsletter/resend-sender.ts
// Sends newsletter HTML emails via Resend, in batches to respect rate limits.
//
// Prerequisites (one-time setup in Resend dashboard):
//   1. Verify domain at https://resend.com/domains  (e.g. aodeporte.com)
//   2. Set RESEND_FROM_EMAIL env var to a verified address (e.g. noreply@aodeporte.com)
//
// Rate limits (free plan): 1 req/s, 100 emails/day, 3,000/month.
// Paid plans raise limits substantially.
// =============================================================================

import 'server-only';
import { Resend } from 'resend';

export type NewsletterResendResult = {
  success:        boolean;
  sentCount:      number;
  failedCount:    number;
  failedEmails:   string[];
  error:          string | null;
};

function getClient(): Resend {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('RESEND_API_KEY is not set.');
  return new Resend(apiKey);
}

/**
 * Sends an HTML newsletter to a list of email addresses via Resend.
 *
 * @param asunto       - Email subject line
 * @param previewText  - Preview / preheader text
 * @param htmlContent  - Full HTML body
 * @param emails       - Recipient email addresses (resolved from profiles)
 * @param batchSize    - Emails per batch (default 50 — safe for free plan)
 * @param delayMs      - Delay between batches in ms (default 1100ms)
 */
export async function sendNewsletterViaResend(
  asunto:      string,
  previewText: string,
  htmlContent: string,
  emails:      string[],
  batchSize  = 50,
  delayMs    = 1100,
): Promise<NewsletterResendResult> {
  if (emails.length === 0) {
    return { success: true, sentCount: 0, failedCount: 0, failedEmails: [], error: null };
  }

  const from = process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev';
  const client = getClient();

  let sentCount   = 0;
  let failedCount = 0;
  const failedEmails: string[] = [];

  for (let i = 0; i < emails.length; i += batchSize) {
    const batch = emails.slice(i, i + batchSize);

    await Promise.all(
      batch.map(async (to) => {
        const { error } = await client.emails.send({
          from,
          to:      [to],
          subject: asunto,
          html:    htmlContent,
          ...(previewText ? { text: previewText } : {}),
        });
        if (error) {
          failedCount++;
          failedEmails.push(to);
        } else {
          sentCount++;
        }
      })
    );

    // Rate-limit pause between batches
    if (i + batchSize < emails.length) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  return {
    success:      failedCount === 0,
    sentCount,
    failedCount,
    failedEmails,
    error:        failedCount > 0
                    ? `${failedCount} email(s) fallaron. Revisa failedEmails.`
                    : null,
  };
}
