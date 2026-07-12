// =============================================================================
// app/api/cron/process-ticket-automation/route.ts
// Vercel Cron handler — runs daily at 08:00 UTC (see vercel.json).
//
// Two phases:
//   Phase 1a  ticket_overdue rules     — finds tickets past due_date, sends email
//   Phase 1b  ticket_pending_response  — finds tickets with no activity, sends reminder
//   Phase 2   job flush                — delivers delayed ticket_email_jobs already queued
//
// Deduplication prevents re-sending the same automation email within the rule’s window.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { processTicketAutomation } from '@/lib/notifications/ticket-email-service';
import { requireCronAuth }         from '@/lib/cron/auth';

export const runtime = 'nodejs';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const denied = requireCronAuth(req);
  if (denied) return denied;

  try {
    const result = await processTicketAutomation();
    return NextResponse.json({
      ok:               true,
      overdue_sent:     result.overdue_processed,
      pending_sent:     result.pending_processed,
      jobs_flushed:     result.jobs_flushed,
      skipped_dedup:    result.skipped_dedup,
      errors:           result.errors,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
