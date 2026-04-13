// =============================================================================
// app/api/cron/process-email-jobs/route.ts
// Vercel Cron handler — runs every minute.
//
// Step 1: processScheduledEmailCampaigns()
//   Finds due scheduled campaigns, resolves their audience, and inserts
//   individual email_job rows (one per recipient).
//
// Step 2: processPendingEmailJobs()
//   Sends pending/retrying jobs via Resend with exponential-backoff retry.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { processPendingEmailJobs }        from '@/lib/notifications/email-service';
import { processScheduledEmailCampaigns } from '@/lib/notifications/scheduler';

export const runtime = 'nodejs';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 1. Campaign → jobs
    const scheduled = await processScheduledEmailCampaigns();

    // 2. Jobs → provider send
    const sent = await processPendingEmailJobs();

    return NextResponse.json({
      ok: true,
      campaigns_dispatched: scheduled.dispatched,
      campaigns_failed:     scheduled.failed,
      campaign_errors:      scheduled.errors,
      jobs_processed:       sent.processed,
      jobs_failed:          sent.failed,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
