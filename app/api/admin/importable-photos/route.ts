import { NextRequest, NextResponse } from 'next/server';
import { requireRouteAuth }          from '@/lib/rbac/server';
import { supabaseAdmin }             from '@/lib/supabase-admin';

/**
 * GET /api/admin/importable-photos?excludeId=<activityId>
 *
 * Returns photos from all activities except the one being edited,
 * enriched with their album (activity) metadata.
 * Used by GalleryPhotoImporter in the Bitácora editor.
 */
export async function GET(req: NextRequest) {
  const denied = await requireRouteAuth();
  if (denied) return denied;

  const excludeId = new URL(req.url).searchParams.get('excludeId') ?? '';

  // Step 1: fetch all photos, filter current activity JS-side
  // (avoids any .neq() edge-case with empty/null excludeId)
  const { data: photoRows, error: photoErr } = await supabaseAdmin
    .from('activity_photos')
    .select('id, activity_id, storage_path, caption, alt_text')
    .order('created_at', { ascending: false })
    .limit(300);

  if (photoErr) {
    console.error('[importable-photos] photos query:', photoErr.message);
    return NextResponse.json([]);
  }

  const rows = (photoRows ?? []).filter(
    (p: { activity_id: string }) => !excludeId || p.activity_id !== excludeId,
  );

  if (rows.length === 0) return NextResponse.json([]);

  // Step 2: fetch album metadata
  const albumIds = [...new Set(rows.map((p: { activity_id: string }) => p.activity_id))];
  const { data: activityRows, error: actErr } = await supabaseAdmin
    .from('activities')
    .select('id, title, event_date, disciplina, sede')
    .in('id', albumIds);

  if (actErr) {
    console.error('[importable-photos] activities query:', actErr.message);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const actMap = new Map<string, any>(
    (activityRows ?? []).map((a: { id: string }) => [a.id, a]),
  );

  const photos = (rows as {
    id: string; activity_id: string; storage_path: string;
    caption: string | null; alt_text: string;
  }[]).map((p) => {
    const act = actMap.get(p.activity_id);
    return {
      id:           p.id,
      activity_id:  p.activity_id,
      storage_path: p.storage_path,
      caption:      p.caption,
      alt_text:     p.alt_text,
      album_title:  act?.title      ?? '',
      album_date:   act?.event_date ?? null,
      disciplina:   act?.disciplina ?? null,
      sede:         act?.sede       ?? null,
    };
  });

  return NextResponse.json(photos);
}
