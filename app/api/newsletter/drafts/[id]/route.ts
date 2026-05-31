// =============================================================================
// app/api/newsletter/drafts/[id]/route.ts
// GET  — Fetch a single draft by ID (all fields incl. html_content).
// PATCH — Update tips_json and rebuild html_content for a pending draft.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser }             from '@/lib/rbac/server';
import { supabaseAdmin }              from '@/lib/supabase-admin';
import { buildEmailHTML }             from '@/lib/newsletter/generator';
import type { Tip, NewsletterAudiencia } from '@/lib/newsletter/types';

export const runtime = 'nodejs';

const MANAGE_ROLES = new Set([
  'super_admin', 'program_director', 'event_coordinator',
  'coach', 'medic', 'physio', 'psychologist', 'nutritionist',
]);

// ── GET ──────────────────────────────────────────────────────────────────────
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;

  const user = await getCurrentUser();
  if (!user?.profile) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const hasAccess =
    user.permissions.has('newsletter.view') ||
    user.permissions.has('newsletter.manage') ||
    user.roles.some((r) => MANAGE_ROLES.has(r.code));

  if (!hasAccess) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data, error } = await supabaseAdmin
    .from('newsletter_drafts')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data)  return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({ ok: true, data });
}

// ── PATCH ─────────────────────────────────────────────────────────────────────
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id: draftId } = await params;

  const user = await getCurrentUser();
  if (!user?.profile) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const hasAccess =
    user.permissions.has('newsletter.manage') ||
    user.permissions.has('newsletter.approve') ||
    user.roles.some((r) => MANAGE_ROLES.has(r.code));

  if (!hasAccess) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: {
    tips?:                 Tip[];
    custom_message_title?: string | null;
    custom_message?:       string | null;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const hasTipsUpdate    = body.tips !== undefined;
  const hasMessageUpdate = body.custom_message !== undefined || body.custom_message_title !== undefined;

  if (hasTipsUpdate && (!Array.isArray(body.tips) || body.tips.length !== 3)) {
    return NextResponse.json({ error: 'Exactly 3 tips required' }, { status: 400 });
  }

  if (!hasTipsUpdate && !hasMessageUpdate) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  }

  // Fetch existing draft
  const { data: draft, error: fetchErr } = await supabaseAdmin
    .from('newsletter_drafts')
    .select('id, status, audiencia, asunto, preview_text, intro, tips_json, custom_message_title, custom_message')
    .eq('id', draftId)
    .maybeSingle();

  if (fetchErr || !draft) {
    return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
  }

  if (draft.status !== 'pending') {
    return NextResponse.json({ error: `Draft is ${draft.status}, cannot edit` }, { status: 409 });
  }

  // Resolve final values (merge incoming with existing)
  const finalTips    = hasTipsUpdate    ? body.tips!          : (draft.tips_json as Tip[]);
  const finalMsgTitle = hasMessageUpdate && body.custom_message_title !== undefined
    ? body.custom_message_title
    : (draft.custom_message_title as string | null);
  const finalMsg = hasMessageUpdate && body.custom_message !== undefined
    ? body.custom_message
    : (draft.custom_message as string | null);

  // Rebuild HTML with current tips + custom message
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://aodeporte.com';
  const content = {
    asunto:  draft.asunto,
    preview: draft.preview_text ?? '',
    intro:   draft.intro ?? '',
    tips:    finalTips,
  };
  const html_content = buildEmailHTML(
    content,
    draft.audiencia as NewsletterAudiencia,
    appUrl,
    finalMsg ? { title: finalMsgTitle ?? undefined, body: finalMsg } : undefined
  );

  // Build update payload
  const updateData: Record<string, unknown> = { html_content };
  if (hasTipsUpdate)    updateData.tips_json             = finalTips;
  if (hasMessageUpdate) updateData.custom_message_title  = finalMsgTitle;
  if (hasMessageUpdate) updateData.custom_message         = finalMsg;

  const { error: updateErr } = await supabaseAdmin
    .from('newsletter_drafts')
    .update(updateData)
    .eq('id', draftId);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, draftId, html_content });
}
