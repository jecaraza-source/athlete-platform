import 'server-only';
// =============================================================================
// lib/historiaGraficaQueries.ts
// Data fetching for the Historia Gráfica (photo gallery) admin module.
// Reuses the existing activities + activity_photos tables and the
// activity-photos Supabase Storage bucket.
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase-admin';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AlbumSummary {
  id:          string;
  title:       string;
  event_date:  string | null;
  disciplina:  string | null;
  sede:        string | null;
  tags:        string[];
  photo_count: number;
  /** storage_path of the featured photo (or first photo) for the thumbnail. */
  cover_path:  string | null;
}

export interface GalleryPhoto {
  id:           string;
  activity_id:  string;
  storage_path: string;
  caption:      string | null;
  alt_text:     string;
  featured:     boolean;
  display_order: number;
  created_at:   string;
  // Joined from activities
  album_title:  string;
  album_date:   string | null;
  disciplina:   string | null;
  sede:         string | null;
  tags:         string[];
}

export interface GalleryData {
  albums:      AlbumSummary[];
  photos:      GalleryPhoto[];
  disciplines: string[];
}

// ─── Query ────────────────────────────────────────────────────────────────────

/**
 * Fetches all albums (activities) and their photos for the Historia Gráfica
 * admin gallery. Returns flat lists that the client filters locally.
 *
 * We limit to activities that have at least one photo OR were created
 * via Historia Gráfica (tag: 'historia_grafica'), plus a fallback
 * that shows all activities to avoid missing albums.
 */
export async function fetchGalleryData(): Promise<GalleryData> {
  // Fetch all activities as potential albums
  const activitiesRes = await supabaseAdmin
    .from('activities')
    .select('id, title, event_date, disciplina, sede, tags')
    .order('event_date', { ascending: false, nullsFirst: false });

  const activities = (activitiesRes.data ?? []) as {
    id: string; title: string; event_date: string | null;
    disciplina: string | null; sede: string | null; tags: string[];
  }[];

  if (activities.length === 0) {
    return { albums: [], photos: [], disciplines: [] };
  }

  // Fetch all photos with activity join (many-to-one)
  const photosRes = await supabaseAdmin
    .from('activity_photos')
    .select('id, activity_id, storage_path, caption, alt_text, featured, display_order, created_at, activities(id, title, event_date, disciplina, sede, tags)')
    .order('created_at', { ascending: false });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawPhotos = (photosRes.data ?? []) as unknown as Array<{
    id: string; activity_id: string; storage_path: string; caption: string | null;
    alt_text: string; featured: boolean; display_order: number; created_at: string;
    activities: { id: string; title: string; event_date: string | null; disciplina: string | null; sede: string | null; tags: string[] } | null;
  }>;

  // Group photos by activity_id to compute album stats
  const photosByActivity = new Map<string, typeof rawPhotos>();
  for (const p of rawPhotos) {
    const list = photosByActivity.get(p.activity_id) ?? [];
    list.push(p);
    photosByActivity.set(p.activity_id, list);
  }

  // Build AlbumSummary list — only include activities that have photos
  const albums: AlbumSummary[] = activities
    .map((a) => {
      const photos = photosByActivity.get(a.id) ?? [];
      if (photos.length === 0) return null; // skip empty albums
      const cover = photos.find((p) => p.featured) ?? photos[0] ?? null;
      return {
        id:          a.id,
        title:       a.title,
        event_date:  a.event_date,
        disciplina:  a.disciplina,
        sede:        a.sede,
        tags:        a.tags ?? [],
        photo_count: photos.length,
        cover_path:  cover?.storage_path ?? null,
      } satisfies AlbumSummary;
    })
    .filter(Boolean) as AlbumSummary[];

  // Flatten photos with activity metadata
  const photos: GalleryPhoto[] = rawPhotos.map((p) => ({
    id:           p.id,
    activity_id:  p.activity_id,
    storage_path: p.storage_path,
    caption:      p.caption,
    alt_text:     p.alt_text,
    featured:     p.featured,
    display_order: p.display_order,
    created_at:   p.created_at,
    album_title:  p.activities?.title       ?? '',
    album_date:   p.activities?.event_date  ?? null,
    disciplina:   p.activities?.disciplina  ?? null,
    sede:         p.activities?.sede        ?? null,
    tags:         p.activities?.tags        ?? [],
  }));

  // Unique, sorted disciplines from albums
  const disciplines = [
    ...new Set(
      albums.map((a) => a.disciplina).filter(Boolean) as string[]
    ),
  ].sort();

  return { albums, photos, disciplines };
}

// ─── Importable photos (for Bitácora editor) ──────────────────────────────────

/** Lightweight type for the photo-importer modal. */
export interface ImportablePhoto {
  id:           string;
  activity_id:  string;
  storage_path: string;
  caption:      string | null;
  alt_text:     string;
  album_title:  string;
  album_date:   string | null;
  disciplina:   string | null;
  sede:         string | null;
}

/**
 * Returns photos from all activities EXCEPT `excludeActivityId`.
 * Called server-side in the Bitácora editor page and passed as props
 * to avoid any client-side fetch/auth issues.
 */
export async function fetchImportablePhotos(
  excludeActivityId: string,
): Promise<ImportablePhoto[]> {
  // 1. All photos not belonging to the article being edited
  const { data: photoRows, error: photoErr } = await supabaseAdmin
    .from('activity_photos')
    .select('id, activity_id, storage_path, caption, alt_text')
    .order('created_at', { ascending: false })
    .limit(400);

  if (photoErr) {
    console.error('[fetchImportablePhotos] query error:', photoErr.message);
    return [];
  }

  console.log(`[fetchImportablePhotos] total in activity_photos: ${photoRows?.length ?? 0}, excludeId: ${excludeActivityId}`);

  const rows = (photoRows ?? []).filter(
    (p: { activity_id: string }) => p.activity_id !== excludeActivityId,
  );

  console.log(`[fetchImportablePhotos] after filter: ${rows.length} rows`);

  if (rows.length === 0) return [];

  // 2. Album metadata for those photos
  const albumIds = [...new Set(
    rows.map((p: { activity_id: string }) => p.activity_id),
  )];

  const { data: actRows } = await supabaseAdmin
    .from('activities')
    .select('id, title, event_date, disciplina, sede')
    .in('id', albumIds);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const actMap = new Map<string, any>(
    (actRows ?? []).map((a: { id: string }) => [a.id, a]),
  );

  return (rows as {
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
    } satisfies ImportablePhoto;
  });
}
