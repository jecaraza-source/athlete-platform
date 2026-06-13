// =============================================================================
// app/api/newsletter/send-now/route.ts
// POST — Send an approved newsletter immediately (bypass cron schedule).
//
// Body: { draftId: string }
//
// The draft must already be in status='approved'. Fetches recipients based
// on the draft's audiencia + recipient_ids, sends via OneSignal email, and
// updates the draft to status='sent'.
//
// Access: roles with newsletter.send permission (super_admin, program_director)
//         OR any approve role (since they're the ones approving+sending)
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser }             from '@/lib/rbac/server';
import { supabaseAdmin }              from '@/lib/supabase-admin';
import { sendNewsletterViaResend }    from '@/lib/newsletter/resend-sender';

export const runtime     = 'nodejs';
export const maxDuration = 300; // Resend batching may take longer for large lists

// Roles allowed to send newsletters immediately
const SEND_ROLES = new Set([
  'super_admin',
  'program_director',
  'event_coordinator',
  'coach',
  'medic',
  'physio',
  'psychologist',
  'nutritionist',
]);

// Role → profiles.role mapping (same as newsletter-send cron)
const AUDIENCE_ROLES: Record<string, string[]> = {
  atleta:     ['athlete', 'guardian'],
  coach:      ['coach'],
  staff:      ['super_admin', 'program_director', 'event_coordinator',
               'coach', 'medic', 'physio', 'psychologist', 'nutritionist'],
  all:        [],
  individual: [],
};

async function resolveRecipients(
  audiencia: string,
  recipientIds: string[]
): Promise<string[]> {
  if (audiencia === 'individual') {
    // Use the explicit list from the draft
    if (recipientIds.length === 0) return [];
    const { data } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .in('id', recipientIds)
      .eq('newsletter_enabled', true);
    return (data ?? []).map((p: { id: string }) => p.id);
  }

  const roles = AUDIENCE_ROLES[audiencia] ?? [];
  let query = supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('newsletter_enabled', true);

  if (roles.length > 0) query = query.in('role', roles);

  const { data } = await query;
  return (data ?? []).map((p: { id: string }) => p.id);
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  // 1. Authenticate & authorize
  const user = await getCurrentUser();
  if (!user?.profile) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const canSend =
    user.permissions.has('newsletter.send') ||
    user.permissions.has('newsletter.approve') ||
    user.roles.some((r) => SEND_ROLES.has(r.code));

  if (!canSend) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // 2. Parse body
  let body: { draftId?: string };
  try {
    body = (await req.json()) as { draftId?: string };
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { draftId } = body;
  if (!draftId) {
    return NextResponse.json({ error: 'draftId is required' }, { status: 400 });
  }

  // 3. Fetch draft — must be approved
  const { data: draft, error: fetchErr } = await supabaseAdmin
    .from('newsletter_drafts')
    .select('id, status, audiencia, asunto, preview_text, html_content, recipient_ids')
    .eq('id', draftId)
    .maybeSingle();

  if (fetchErr || !draft) {
    return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
  }

  if (draft.status !== 'approved') {
    return NextResponse.json(
      { error: `Draft status is '${draft.status}'. Only approved drafts can be sent.` },
      { status: 409 }
    );
  }

  // Guard: html_content must exist before sending
  if (!draft.html_content?.trim()) {
    return NextResponse.json(
      { error: 'El newsletter no tiene contenido HTML. Regenera el borrador antes de enviarlo.' },
      { status: 422 }
    );
  }

  // 4. Resolve recipients → get their email addresses
  const recipientIds = Array.isArray(draft.recipient_ids) ? draft.recipient_ids as string[] : [];
  const profileIds   = await resolveRecipients(draft.audiencia, recipientIds);

  if (profileIds.length === 0) {
    return NextResponse.json(
      { error: 'No subscribers found for this audience.' },
      { status: 422 }
    );
  }

  // Fetch email addresses for all resolved profile IDs
  const { data: profileRows } = await supabaseAdmin
    .from('profiles')
    .select('email')
    .in('id', profileIds)
    .not('email', 'is', null);

  const emails = (profileRows ?? [])
    .map((p: { email: string | null }) => p.email)
    .filter((e): e is string => !!e);

  if (emails.length === 0) {
    return NextResponse.json(
      { error: 'No email addresses found for the resolved recipients.' },
      { status: 422 }
    );
  }

  // 5. Send via Resend
  const result = await sendNewsletterViaResend(
    draft.asunto,
    draft.preview_text ?? '',
    draft.html_content,
    emails,
  );

  if (!result.success && result.sentCount === 0) {
    await supabaseAdmin.from('newsletter_logs').insert({
      draft_id:   draftId,
      action:     'error',
      actor_id:   user.profile.id,
      actor_role: user.roles[0]?.code ?? 'unknown',
      note:       result.error ?? 'Resend send failed',
      metadata:   { failed_emails: result.failedEmails },
    });
    return NextResponse.json({ error: result.error ?? 'Send failed' }, { status: 500 });
  }

  // 6. Mark as sent
  const now = new Date().toISOString();
  await supabaseAdmin
    .from('newsletter_drafts')
    .update({
      status:          'sent',
      sent_at:         now,
      recipient_count: result.sentCount,
    })
    .eq('id', draftId);

  // 7. Audit log
  await supabaseAdmin.from('newsletter_logs').insert({
    draft_id:   draftId,
    action:     'sent',
    actor_id:   user.profile.id,
    actor_role: user.roles[0]?.code ?? 'unknown',
    note:       `Enviado vía Resend a ${result.sentCount} destinatarios${
      result.failedCount > 0 ? ` (${result.failedCount} fallaron)` : ''
    }`,
    metadata:   {
      provider:       'resend',
      sent_count:     result.sentCount,
      failed_count:   result.failedCount,
      failed_emails:  result.failedEmails,
      audiencia:      draft.audiencia,
    },
  });

  return NextResponse.json({
    ok:             true,
    draftId,
    recipientCount: result.sentCount,
    failedCount:    result.failedCount,
  });
}
