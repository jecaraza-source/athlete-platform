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

  let body: { tips?: Tip[] };
  try {
    body = (await req.json()) as { tips?: Tip[] };
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.tips || !Array.isArray(body.tips) || body.tips.length !== 3) {
    return NextResponse.json({ error: 'Exactly 3 tips required' }, { status: 400 });
  }

  // Fetch existing draft
  const { data: draft, error: fetchErr } = await supabaseAdmin
    .from('newsletter_drafts')
    .select('id, status, audiencia, asunto, preview_text, intro')
    .eq('id', draftId)
    .maybeSingle();

  if (fetchErr || !draft) {
    return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
  }

  if (draft.status !== 'pending') {
    return NextResponse.json({ error: `Draft is ${draft.status}, cannot edit` }, { status: 409 });
  }

  // Rebuild HTML with new tips
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://aodeporte.com';
  const content = {
    asunto:  draft.asunto,
    preview: draft.preview_text ?? '',
    intro:   draft.intro ?? '',
    tips:    body.tips,
  };
  const html_content = buildEmailHTML(content, draft.audiencia as NewsletterAudiencia, appUrl);

  const { error: updateErr } = await supabaseAdmin
    .from('newsletter_drafts')
    .update({ tips_json: body.tips, html_content })
    .eq('id', draftId);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, draftId, html_content });
}
