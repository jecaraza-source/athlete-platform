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
import { sendNewsletterViaOneSignal, notifyUsersNewsletterPublished } from '@/lib/newsletter/onesignal';
import { getProfileIdsForRoleCodes }   from '@/lib/newsletter/audience-roles';
import type { NewsletterAudiencia }    from '@/lib/newsletter/types';

export const runtime    = 'nodejs';
export const maxDuration = 120;

// OneSignal has had the Email channel disabled account-wide since 2026-07-16
// ("contact our Support team" — not self-service). Until support lifts it,
// every send fails with this exact message. Rather than let drafts pile up
// as 'approved' forever (and the mobile app go stale), auto-stopgap them:
// mark as sent with recipient_count 0, same as the manual workaround applied
// by hand on 2026-07-16/18/20/23. Remove this once OneSignal re-enables email.
const ONESIGNAL_EMAIL_DISABLED_MARKER = 'Email sending for this app has been disabled';

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

      if (!result.success && result.error?.includes(ONESIGNAL_EMAIL_DISABLED_MARKER)) {
        await supabaseAdmin
          .from('newsletter_drafts')
          .update({ status: 'sent', sent_at: new Date().toISOString(), recipient_count: 0 })
          .eq('id', draft.id);

        await supabaseAdmin.from('newsletter_logs').insert({
          draft_id:   draft.id,
          action:     'sent',
          actor_id:   null,
          actor_role: 'system',
          note:       'Auto stopgap: OneSignal tiene el envío de email deshabilitado a nivel de cuenta ("contact our Support team"). Marcado como enviado sin email/push real para no bloquear la app móvil.',
          metadata:   { manual_stopgap: true, automatic: true, reason: 'onesignal_email_sending_disabled_by_platform' },
        });

        results.push({ draftId: draft.id, audiencia: draft.audiencia, status: 'sent', recipientCount: 0 });
        continue;
      }

      if (!result.success) {
        throw new Error(result.error ?? 'OneSignal send failed');
      }

      // 3. Mark as sent
      await supabaseAdmin
        .from('newsletter_drafts')
        .update({
          status:          'sent',
          sent_at:         new Date().toISOString(),
          onesignal_id:    result.onesignalId,
          recipient_count: result.recipientCount,
        })
        .eq('id', draft.id);

      // 4. Push notification to mobile users — best-effort, never blocks the response.
      await notifyUsersNewsletterPublished({
        draftId:     draft.id,
        asunto:      draft.asunto,
        externalIds,
      });

      // 5. Audit log
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
