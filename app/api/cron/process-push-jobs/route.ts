// =============================================================================
// app/api/cron/process-push-jobs/route.ts
// Vercel Cron handler — runs daily at 07:00 UTC (see vercel.json).
//
// Step 1: processScheduledPushCampaigns()
//   Finds due scheduled push campaigns, looks up active device tokens for
//   the resolved audience, and inserts individual push_job rows.
//
// Step 2: processPendingPushJobs()
//   Sends pending/retrying jobs via OneSignal with retry/backoff.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { processPendingPushJobs }        from '@/lib/notifications/push-service';
import { processScheduledPushCampaigns } from '@/lib/notifications/scheduler';
import { requireCronAuth }              from '@/lib/cron/auth';

export const runtime = 'nodejs';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const denied = requireCronAuth(req);
  if (denied) return denied;

  try {
    // 1. Campaign → jobs
    const scheduled = await processScheduledPushCampaigns();

    // 2. Jobs → provider send
    const sent = await processPendingPushJobs();

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
