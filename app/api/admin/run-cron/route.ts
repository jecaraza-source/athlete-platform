// =============================================================================
// app/api/admin/run-cron/route.ts
// Admin-only endpoint to manually trigger any cron job.
// Use in development (Vercel Cron only runs in production).
//
// POST /api/admin/run-cron
// Body: { "job": "email" | "push" | "ticket" }
// Auth: must be an authenticated admin.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireRoutePermission }         from '@/lib/rbac/server';
import { processScheduledEmailCampaigns } from '@/lib/notifications/scheduler';
import { processScheduledPushCampaigns }  from '@/lib/notifications/scheduler';
import { processPendingEmailJobs }        from '@/lib/notifications/email-service';
import { processPendingPushJobs }         from '@/lib/notifications/push-service';
import { processTicketAutomation }        from '@/lib/notifications/ticket-email-service';

export const runtime = 'nodejs';

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Must be an admin with campaign management permission
  const denied = await requireRoutePermission('manage_email_campaigns');
  if (denied) return denied as unknown as NextResponse;

  let body: { job?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { job } = body;

  try {
    switch (job) {
      case 'email': {
        const scheduled = await processScheduledEmailCampaigns();
        const sent      = await processPendingEmailJobs();
        return NextResponse.json({
          ok:   true,
          job:  'email',
          campaigns_dispatched: scheduled.dispatched,
          campaigns_failed:     scheduled.failed,
          campaign_errors:      scheduled.errors,
          jobs_processed:       sent.processed,
          jobs_failed:          sent.failed,
        });
      }

      case 'push': {
        const scheduled = await processScheduledPushCampaigns();
        const sent      = await processPendingPushJobs();
        return NextResponse.json({
          ok:   true,
          job:  'push',
          campaigns_dispatched: scheduled.dispatched,
          campaigns_failed:     scheduled.failed,
          campaign_errors:      scheduled.errors,
          jobs_processed:       sent.processed,
          jobs_failed:          sent.failed,
        });
      }

      case 'ticket': {
        const result = await processTicketAutomation();
        return NextResponse.json({
          ok:             true,
          job:            'ticket',
          overdue_sent:   result.overdue_processed,
          pending_sent:   result.pending_processed,
          jobs_flushed:   result.jobs_flushed,
          skipped_dedup:  result.skipped_dedup,
          errors:         result.errors,
        });
      }

      default:
        return NextResponse.json(
          { error: 'Unknown job. Use "email", "push", or "ticket".' },
          { status: 400 }
        );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
