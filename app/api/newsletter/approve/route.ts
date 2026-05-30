// =============================================================================
// app/api/newsletter/approve/route.ts
// POST — Approve or reject a newsletter draft.
//
// Body: { draftId: string, action: 'approved' | 'rejected', note?: string }
//
// Access: roles with newsletter.approve permission
// (super_admin, program_director, event_coordinator, coach, medic, physio,
//  psychologist, nutritionist)
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser }             from '@/lib/rbac/server';
import { supabaseAdmin }              from '@/lib/supabase-admin';

export const runtime = 'nodejs';

const APPROVE_ROLES = new Set([
  'super_admin',
  'program_director',
  'event_coordinator',
  'coach',
  'medic',
  'physio',
  'psychologist',
  'nutritionist',
]);

export async function POST(req: NextRequest): Promise<NextResponse> {
  // 1. Authenticate
  const user = await getCurrentUser();
  if (!user?.profile) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Authorise — must have newsletter.approve permission OR be in approve roles
  const hasPermission = user.permissions.has('newsletter.approve')
    || user.roles.some((r) => APPROVE_ROLES.has(r.code));

  if (!hasPermission) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // 3. Parse body
  let body: {
    draftId?:      string;
    action?:       string;
    note?:         string;
    // Optional: override audience + recipients at approval time
    audiencia?:    string;
    recipientIds?: string[];
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { draftId, action, note, audiencia: newAudiencia, recipientIds } = body;

  if (!draftId || !action) {
    return NextResponse.json({ error: 'draftId and action are required' }, { status: 400 });
  }

  if (action !== 'approved' && action !== 'rejected') {
    return NextResponse.json({ error: 'action must be approved or rejected' }, { status: 400 });
  }

  if (action === 'rejected' && !note?.trim()) {
    return NextResponse.json({ error: 'A rejection reason (note) is required' }, { status: 400 });
  }

  // 4. Verify draft exists and is pending
  const { data: draft, error: fetchErr } = await supabaseAdmin
    .from('newsletter_drafts')
    .select('id, status, audiencia')
    .eq('id', draftId)
    .maybeSingle();

  if (fetchErr || !draft) {
    return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
  }

  if (draft.status !== 'pending') {
    return NextResponse.json(
      { error: `Draft is already ${draft.status}` },
      { status: 409 }
    );
  }

  // 5. Update draft
  const now = new Date().toISOString();
  const actorRole = user.roles[0]?.code ?? 'unknown';

  // Build update payload, optionally overriding audience + recipients
  const updatePayload =
    action === 'approved'
      ? {
          status:        'approved',
          approved_by:   user.profile.id,
          approved_at:   now,
          approval_note: note?.trim() ?? null,
          // Update audience if explicitly changed
          ...(newAudiencia ? { audiencia: newAudiencia } : {}),
          ...(recipientIds ? { recipient_ids: recipientIds } : {}),
        }
      : {
          status:           'rejected',
          rejected_reason:  note!.trim(),
        };

  const { error: updateErr } = await supabaseAdmin
    .from('newsletter_drafts')
    .update(updatePayload)
    .eq('id', draftId);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  // 6. Audit log
  await supabaseAdmin.from('newsletter_logs').insert({
    draft_id:   draftId,
    action,
    actor_id:   user.profile.id,
    actor_role: actorRole,
    note:       note?.trim() ?? null,
    metadata:   {
      audiencia:      newAudiencia ?? draft.audiencia,
      recipient_count: recipientIds?.length ?? null,
    },
  });

  return NextResponse.json({ ok: true, draftId, action });
}
