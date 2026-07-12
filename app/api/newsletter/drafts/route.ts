// =============================================================================
// app/api/newsletter/drafts/route.ts
// GET — Paginated list of newsletter drafts.
//
// Query params:
//   status   — filter by draft status (pending|approved|rejected|sent|cancelled)
//   audiencia — filter by audience (atleta|coach|all)
//   limit    — page size (default 20, max 100)
//   page     — 1-indexed page number (default 1)
//
// Access: roles with newsletter.view or newsletter.manage permission
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser }             from '@/lib/rbac/server';
import { supabaseAdmin }              from '@/lib/supabase-admin';

export const runtime = 'nodejs';

const VIEW_ROLES = new Set([
  'super_admin',
  'program_director',
  'event_coordinator',
  'coach',
  'medic',
  'physio',
  'psychologist',
  'nutritionist',
]);

export async function GET(req: NextRequest): Promise<NextResponse> {
  // 1. Authenticate & authorise
  const user = await getCurrentUser();
  if (!user?.profile) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const hasAccess =
    user.permissions.has('newsletter.view') ||
    user.permissions.has('newsletter.manage') ||
    user.roles.some((r) => VIEW_ROLES.has(r.code));

  if (!hasAccess) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // 2. Parse query params
  const { searchParams } = new URL(req.url);
  const status    = searchParams.get('status')    ?? undefined;
  const audiencia = searchParams.get('audiencia') ?? undefined;
  const limit     = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 100);
  const page      = Math.max(parseInt(searchParams.get('page')  ?? '1',  10), 1);
  const offset    = (page - 1) * limit;

  // 3. Build query
  let query = supabaseAdmin
    .from('newsletter_drafts')
    .select(
      'id, audiencia, asunto, preview_text, intro, tips_json, html_content, ' +
      'status, scheduled_for, recipient_ids, ' +
      'approved_by, approved_at, approval_note, rejected_reason, ' +
      'onesignal_id, recipient_count, sent_at, created_at, updated_at',
      { count: 'exact' }
    );

  if (status)    query = query.eq('status',    status);
  if (audiencia) query = query.eq('audiencia', audiencia);

  const { data, count, error } = await query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok:    true,
    data:  data ?? [],
    total: count ?? 0,
    page,
    limit,
    pages: Math.ceil((count ?? 0) / limit),
  });
}
