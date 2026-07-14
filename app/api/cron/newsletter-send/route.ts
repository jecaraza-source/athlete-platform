// =============================================================================
// app/api/cron/newsletter-send/route.ts
// Vercel Cron handler — runs daily at 07:00 UTC (see vercel.json).
//
// Finds all newsletter_drafts with status='approved' and scheduled_for <= NOW(),
// resolves the subscriber list for each audience, sends via OneSignal email,
// and updates the draft status to 'sent'.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireCronAuth }             from '@/lib/cron/auth';
import { supabaseAdmin }               from '@/lib/supabase-admin';
import { sendNewsletterViaOneSignal, notifyUsersNewsletterPublished, sendNewsletterPush } from '@/lib/newsletter/onesignal';
import { getProfileIdsForRoleCodes }   from '@/lib/newsletter/audience-roles';
import type { NewsletterAudiencia }    from '@/lib/newsletter/types';

export const runtime    = 'nodejs';
export const maxDuration = 120;

// Which RBAC role codes (roles.code, via user_roles) map to each newsletter
// audience. Mirrors the RLS policy in migration 044.
const AUDIENCE_ROLES: Record<NewsletterAudiencia, string[]> = {
  atleta: ['athlete', 'guardian'],
  coach:  ['coach', 'super_admin', 'program_director', 'event_coordinator',
           'medic', 'physio', 'psychologist', 'nutritionist'],
  all:    [], // empty = fetch everyone
};

async function getSubscriberIds(audiencia: NewsletterAudiencia): Promise<string[]> {
  const roles = AUDIENCE_ROLES[audiencia];
  if (!roles) {
    throw new Error(`Unknown newsletter audiencia: "${audiencia}"`);
  }

  let query = supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('newsletter_enabled', true);

  if (roles.length > 0) {
    const profileIds = await getProfileIdsForRoleCodes(roles);
    if (profileIds.length === 0) return [];
    query = query.in('id', profileIds);
  }

  const { data, error } = await query;
  if (error || !data) return [];
  return data.map((p: { id: string }) => p.id);
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const denied = requireCronAuth(req);
  if (denied) return denied;

  const now = new Date().toISOString();

  // Find all approved drafts due to send
  const { data: drafts, error: fetchErr } = await supabaseAdmin
    .from('newsletter_drafts')
    .select('id, audiencia, asunto, preview_text, html_content')
    .eq('status', 'approved')
    .lte('scheduled_for', now);

  if (fetchErr) {
    return NextResponse.json({ ok: false, error: fetchErr.message }, { status: 500 });
  }

  if (!drafts || drafts.length === 0) {
    return NextResponse.json({ ok: true, results: [], message: 'No approved drafts due.' });
  }

  const results: Array<{
    draftId:        string;
    audiencia:      string;
    status:         'sent' | 'error';
    recipientCount?: number;
    error?:         string;
  }> = [];

  for (const draft of drafts) {
    try {
      // 1. Resolve subscriber list
      const externalIds = await getSubscriberIds(draft.audiencia as NewsletterAudiencia);

      // 2. Send via OneSignal email channel
      const result = await sendNewsletterViaOneSignal({
        asunto:      draft.asunto,
        previewText: draft.preview_text ?? '',
        htmlContent: draft.html_content,
        externalIds,
      });

      if (!result.success) {
        throw new Error(result.error ?? 'OneSignal send failed');
      }

      // 3. Best-effort push notification (refuerzo al email; nunca tumba el request)
      try {
        const pushResult = await sendNewsletterPush({
          asunto:      draft.asunto,
          preview:     draft.preview_text ?? '',
          externalIds,
          draftId:     draft.id,
        });
        if (!pushResult.success) {
          console.warn('[newsletter-send] push best-effort failed:', pushResult.error);
        }
      } catch (pushErr) {
        console.warn('[newsletter-send] push best-effort exception:', pushErr);
      }

      // 4. Mark as sent
      await supabaseAdmin
        .from('newsletter_drafts')
        .update({
          status:          'sent',
          sent_at:         new Date().toISOString(),
          onesignal_id:    result.onesignalId,
          recipient_count: result.recipientCount,
        })
        .eq('id', draft.id);

      // 3.5 Push notification to mobile users — best-effort, same audience
      // resolved above for the email send.
      await notifyUsersNewsletterPublished({
        draftId:     draft.id,
        asunto:      draft.asunto,
        externalIds,
      });

      // 4. Audit log
      await supabaseAdmin.from('newsletter_logs').insert({
        draft_id:   draft.id,
        action:     'sent',
        actor_id:   null,
        actor_role: 'system',
        note:       `Sent to ${result.recipientCount} subscribers`,
        metadata:   { onesignal_id: result.onesignalId, recipient_count: result.recipientCount },
      });

      results.push({
        draftId:        draft.id,
        audiencia:      draft.audiencia,
        status:         'sent',
        recipientCount: result.recipientCount,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);

      // Mark as error in logs but leave status as 'approved' for retry
      try {
        await supabaseAdmin.from('newsletter_logs').insert({
          draft_id:   draft.id,
          action:     'error',
          actor_id:   null,
          actor_role: 'system',
          note:       message,
        });
      } catch { /* best-effort */ }

      results.push({ draftId: draft.id, audiencia: draft.audiencia, status: 'error', error: message });
    }
  }

  const hasError = results.some((r) => r.status === 'error');
  return NextResponse.json(
    { ok: !hasError, results },
    { status: hasError ? 207 : 200 }
  );
}
