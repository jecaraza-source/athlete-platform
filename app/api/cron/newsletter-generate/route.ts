// =============================================================================
// app/api/cron/newsletter-generate/route.ts
// Vercel Cron handler — runs daily at 12:00 UTC (= 6:00 AM Mexico UTC-6).
//
// AUTO-SEND MODE:
// 1. Checks if coaches or staff made edits in the last 24 hours
//    (training sessions, plans, follow-up sessions, nutrition checkins).
// 2. If NO recent activity → skips generation entirely for today.
// 3. If YES → generates newsletter content via Claude for 'atleta' and 'coach',
//    inserts drafts directly as status='approved' (no manual approval needed),
//    and logs the auto-approval.
// 4. The newsletter-send cron (13:00 UTC) picks up 'approved' drafts and sends.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireCronAuth }               from '@/lib/cron/auth';
import { supabaseAdmin }                 from '@/lib/supabase-admin';
import { generateNewsletterContent, buildEmailHTML } from '@/lib/newsletter/generator';
import { scheduledForMX }               from '@/lib/timezone';
import type { NewsletterAudiencia }      from '@/lib/newsletter/types';

export const runtime = 'nodejs';
export const maxDuration = 120;

// Schedules the newsletter for 7:00 AM Mexico City time on the same day.
// scheduledForMX() handles DST automatically (UTC-6 in winter, UTC-5 in summer).

const AUDIENCES: NewsletterAudiencia[] = ['atleta', 'coach'];

// ---------------------------------------------------------------------------
// Staff activity gate
// ---------------------------------------------------------------------------
// Returns the total count of records created by coaches/staff in the last 24h
// across the main activity tables. A count > 0 triggers auto-send.

type ActivityResult = {
  hasActivity: boolean;
  counts: Record<string, number>;
  total: number;
};

async function checkRecentStaffActivity(): Promise<ActivityResult> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const queries = [
    supabaseAdmin
      .from('training_sessions')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', since),
    supabaseAdmin
      .from('plans')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', since),
    supabaseAdmin
      .from('physio_sessions')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', since),
    supabaseAdmin
      .from('psychology_sessions')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', since),
    supabaseAdmin
      .from('medical_sessions')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', since),
    supabaseAdmin
      .from('nutrition_checkins')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', since),
  ];

  const labels = [
    'training_sessions',
    'plans',
    'physio_sessions',
    'psychology_sessions',
    'medical_sessions',
    'nutrition_checkins',
  ];

  const results = await Promise.all(queries);
  const counts: Record<string, number> = {};
  let total = 0;

  results.forEach((res, i) => {
    const n = res.count ?? 0;
    counts[labels[i]] = n;
    total += n;
  });

  return { hasActivity: total > 0, counts, total };
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest): Promise<NextResponse> {
  const denied = requireCronAuth(req);
  if (denied) return denied;

  // 1. Check for recent staff activity
  const activity = await checkRecentStaffActivity();

  if (!activity.hasActivity) {
    // No activity by coaches or staff in the last 24h — skip today's newsletter
    await supabaseAdmin.from('newsletter_logs').insert({
      draft_id:   null,
      action:     'skipped',
      actor_id:   null,
      actor_role: 'system',
      note:       'Sin actividad de staff/coaches en las últimas 24h — newsletter no generado.',
      metadata:   { counts: activity.counts, total: activity.total },
    });

    return NextResponse.json({
      ok:      true,
      skipped: true,
      reason:  'No staff activity in the last 24h',
      counts:  activity.counts,
    });
  }

  // 2. Activity found — generate and auto-approve newsletters
  const appUrl       = process.env.NEXT_PUBLIC_APP_URL ?? 'https://aodeporte.com';
  const scheduledFor = scheduledForMX(7, 0); // 7:00 AM Mexico City

  const results: Array<{
    audiencia: NewsletterAudiencia;
    status:    'auto_approved' | 'error';
    draftId?:  string;
    error?:    string;
  }> = [];

  for (const audiencia of AUDIENCES) {
    try {
      // Generate content via Claude
      const content     = await generateNewsletterContent(audiencia);
      const htmlContent = buildEmailHTML(content, audiencia, appUrl);

      // Insert draft directly as 'approved' — no manual approval step
      const { data: draft, error: insertErr } = await supabaseAdmin
        .from('newsletter_drafts')
        .insert({
          audiencia,
          asunto:        content.asunto,
          preview_text:  content.preview,
          intro:         content.intro,
          tips_json:     content.tips,
          html_content:  htmlContent,
          status:        'approved',
          approved_at:   new Date().toISOString(),
          approved_by:   null,   // system auto-approval
          approval_note: `Auto-aprobado: ${activity.total} registro(s) de staff creados en las últimas 24h.`,
          scheduled_for: scheduledFor,
        })
        .select('id')
        .single();

      if (insertErr || !draft) {
        throw new Error(insertErr?.message ?? 'Failed to insert draft');
      }

      // Audit log — single entry for auto-approval
      await supabaseAdmin.from('newsletter_logs').insert({
        draft_id:   draft.id,
        action:     'auto_approved',
        actor_id:   null,
        actor_role: 'system',
        note:       `Auto-generado y aprobado: ${activity.total} ediciones de staff en últimas 24h.`,
        metadata:   {
          scheduled_for: scheduledFor,
          activity_counts: activity.counts,
          activity_total:  activity.total,
        },
      });

      results.push({ audiencia, status: 'auto_approved', draftId: draft.id });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      results.push({ audiencia, status: 'error', error: message });
    }
  }

  const hasError = results.some((r) => r.status === 'error');
  return NextResponse.json(
    { ok: !hasError, results, activity_counts: activity.counts },
    { status: hasError ? 207 : 200 }
  );
}
