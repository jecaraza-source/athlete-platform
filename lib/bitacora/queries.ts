import 'server-only';
// =============================================================================
// lib/bitacora/queries.ts
// Funciones de lectura para el módulo Bitácora.
// Todas usan supabaseAdmin (bypass RLS) ya que se ejecutan en Server Components,
// Server Actions o Route Handlers donde el acceso está controlado por la capa de app.
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase-admin';
import type {
  Activity,
  ActivityCardData,
  ActivityFilters,
  ActivityPhoto,
  ActivityWithRelations,
  MagazineArticle,
  MagazineIssue,
} from '@/lib/types/bitacora';

const DEFAULT_PER_PAGE = 12;

// ---------------------------------------------------------------------------
// Público — timeline de actividades publicadas
// ---------------------------------------------------------------------------

/** Listado paginado de actividades publicadas con cover_photo y flag has_narrative. */
export async function getPublicActivities(filters: ActivityFilters = {}): Promise<{
  activities: ActivityCardData[];
  total:      number;
  page:       number;
  perPage:    number;
}> {
  const page    = Math.max(1, filters.page    ?? 1);
  const perPage = Math.min(50, filters.perPage ?? DEFAULT_PER_PAGE);
  const from    = (page - 1) * perPage;
  const to      = from + perPage - 1;

  let query = supabaseAdmin
    .from('activities')
    .select('id, slug, type, title, description, event_date, location, tags', { count: 'exact' })
    .eq('status', 'publicado')
    .order('event_date', { ascending: false });

  if (filters.type)  query = query.eq('type', filters.type);
  if (filters.tag)   query = query.contains('tags', [filters.tag]);
  if (filters.month) {
    const [year, month] = filters.month.split('-');
    const start = `${year}-${month}-01`;
    const nextMonth = Number(month) === 12
      ? `${Number(year) + 1}-01-01`
      : `${year}-${String(Number(month) + 1).padStart(2, '0')}-01`;
    query = query.gte('event_date', start).lt('event_date', nextMonth);
  }

  query = query.range(from, to);
  const { data: rows, count, error } = await query;

  if (error || !rows) return { activities: [], total: 0, page, perPage };

  // Para cada actividad, obtener cover_photo y has_narrative en paralelo
  const activityIds = rows.map((r) => r.id);

  const [photosRes, narrativesRes] = await Promise.all([
    supabaseAdmin
      .from('activity_photos')
      .select('*')
      .in('activity_id', activityIds)
      .order('featured', { ascending: false })
      .order('display_order', { ascending: true }),

    supabaseAdmin
      .from('activity_narratives')
      .select('activity_id')
      .in('activity_id', activityIds)
      .eq('status', 'aprobado'),
  ]);

  const photosByActivity = new Map<string, ActivityPhoto[]>();
  for (const p of (photosRes.data ?? []) as ActivityPhoto[]) {
    const list = photosByActivity.get(p.activity_id) ?? [];
    list.push(p);
    photosByActivity.set(p.activity_id, list);
  }

  const approvedNarrativeIds = new Set(
    (narrativesRes.data ?? []).map((n: { activity_id: string }) => n.activity_id)
  );

  const activities: ActivityCardData[] = rows.map((row) => {
    const photos = photosByActivity.get(row.id) ?? [];
    const cover  = photos.find((p) => p.featured) ?? photos[0] ?? null;
    return {
      ...row,
      cover_photo:   cover,
      has_narrative: approvedNarrativeIds.has(row.id),
    } as ActivityCardData;
  });

  return { activities, total: count ?? 0, page, perPage };
}

/** Detalle completo de una actividad publicada por slug (para la página de detalle). */
export async function getPublicActivityBySlug(
  slug: string
): Promise<ActivityWithRelations | null> {
  const { data: activity, error } = await supabaseAdmin
    .from('activities')
    .select('*')
    .eq('slug', slug)
    .eq('status', 'publicado')
    .maybeSingle();

  if (error || !activity) return null;

  const [photosRes, narrativeRes, commentsRes] = await Promise.all([
    supabaseAdmin
      .from('activity_photos')
      .select('*')
      .eq('activity_id', activity.id)
      .order('display_order', { ascending: true }),

    supabaseAdmin
      .from('activity_narratives')
      .select('*')
      .eq('activity_id', activity.id)
      .eq('status', 'aprobado')
      .maybeSingle(),

    supabaseAdmin
      .from('activity_comments')
      .select('id, activity_id, author_name, comment, approved, created_at')
      .eq('activity_id', activity.id)
      .eq('approved', true)
      .order('created_at', { ascending: true }),
  ]);

  return {
    ...(activity as Activity),
    photos:    (photosRes.data   ?? []) as ActivityPhoto[],
    narrative: narrativeRes.data ?? null,
    comments:  (commentsRes.data ?? []).map((c) => ({ ...c, author_email: null })),
  };
}

// ---------------------------------------------------------------------------
// Admin — todas las actividades (borradores + publicados)
// ---------------------------------------------------------------------------

/** Listado admin con todas las actividades y sus conteos. */
export async function getAdminActivities(filters: ActivityFilters = {}): Promise<{
  activities: (Activity & {
    photo_count:   number;
    comment_count: number;
    has_narrative: boolean;
  })[];
  total:   number;
  page:    number;
  perPage: number;
}> {
  const page    = Math.max(1, filters.page    ?? 1);
  const perPage = Math.min(50, filters.perPage ?? DEFAULT_PER_PAGE);
  const from    = (page - 1) * perPage;
  const to      = from + perPage - 1;

  let query = supabaseAdmin
    .from('activities')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false });

  if (filters.status) query = query.eq('status', filters.status);
  if (filters.type)   query = query.eq('type',   filters.type);

  query = query.range(from, to);
  const { data: rows, count, error } = await query;

  if (error || !rows) return { activities: [], total: 0, page, perPage };

  const ids = rows.map((r: Activity) => r.id);

  const [photoCounts, commentCounts, narratives] = await Promise.all([
    supabaseAdmin
      .from('activity_photos')
      .select('activity_id')
      .in('activity_id', ids),

    supabaseAdmin
      .from('activity_comments')
      .select('activity_id')
      .in('activity_id', ids),

    supabaseAdmin
      .from('activity_narratives')
      .select('activity_id, status')
      .in('activity_id', ids),
  ]);

  const photoMap    = new Map<string, number>();
  const commentMap  = new Map<string, number>();
  const narrativeMap = new Map<string, boolean>();

  for (const p of (photoCounts.data ?? []) as { activity_id: string }[]) {
    photoMap.set(p.activity_id, (photoMap.get(p.activity_id) ?? 0) + 1);
  }
  for (const c of (commentCounts.data ?? []) as { activity_id: string }[]) {
    commentMap.set(c.activity_id, (commentMap.get(c.activity_id) ?? 0) + 1);
  }
  for (const n of (narratives.data ?? []) as { activity_id: string; status: string }[]) {
    narrativeMap.set(n.activity_id, true);
  }

  const activities = rows.map((r: Activity) => ({
    ...r,
    photo_count:   photoMap.get(r.id)   ?? 0,
    comment_count: commentMap.get(r.id) ?? 0,
    has_narrative: narrativeMap.get(r.id) ?? false,
  }));

  return { activities, total: count ?? 0, page, perPage };
}

/** Detalle completo de una actividad para el admin (incluye todos los comentarios y narrativa en cualquier estado). */
export async function getAdminActivityById(
  id: string
): Promise<ActivityWithRelations | null> {
  const { data: activity, error } = await supabaseAdmin
    .from('activities')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error || !activity) return null;

  const [photosRes, narrativeRes, commentsRes] = await Promise.all([
    supabaseAdmin
      .from('activity_photos')
      .select('*')
      .eq('activity_id', id)
      .order('display_order', { ascending: true }),

    supabaseAdmin
      .from('activity_narratives')
      .select('*')
      .eq('activity_id', id)
      .maybeSingle(),

    supabaseAdmin
      .from('activity_comments')
      .select('*')
      .eq('activity_id', id)
      .order('created_at', { ascending: true }),
  ]);

  return {
    ...(activity as Activity),
    photos:    (photosRes.data   ?? []) as ActivityPhoto[],
    narrative: narrativeRes.data ?? null,
    comments:  commentsRes.data  ?? [],
  };
}

// ---------------------------------------------------------------------------
// Revista — artículos con narrativa aprobada
// ---------------------------------------------------------------------------

/** Artículos de la Revista: actividades publicadas con narrativa aprobada. */
export async function getMagazineArticles(limit = 20): Promise<MagazineArticle[]> {
  const { data: narratives, error } = await supabaseAdmin
    .from('activity_narratives')
    .select('*, activities(*)')
    .eq('status', 'aprobado')
    .order('approved_at', { ascending: false })
    .limit(limit);

  if (error || !narratives) return [];

  const activityIds = narratives.map((n: { activity_id: string }) => n.activity_id);

  const { data: photos } = await supabaseAdmin
    .from('activity_photos')
    .select('*')
    .in('activity_id', activityIds)
    .order('featured', { ascending: false })
    .order('display_order', { ascending: true });

  const photosByActivity = new Map<string, ActivityPhoto[]>();
  for (const p of (photos ?? []) as ActivityPhoto[]) {
    const list = photosByActivity.get(p.activity_id) ?? [];
    list.push(p);
    photosByActivity.set(p.activity_id, list);
  }

  return narratives
    .filter((n: { activities: Activity | null }) => n.activities?.status === 'publicado')
    .map((n: { activity_id: string; activities: Activity }) => {
      const activityPhotos = photosByActivity.get(n.activity_id) ?? [];
      const cover  = activityPhotos.find((p) => p.featured) ?? activityPhotos[0] ?? null;
      return {
        narrative: n as unknown as import('@/lib/types/bitacora').ActivityNarrative,
        activity:  {
          ...n.activities,
          cover_photo:   cover,
          has_narrative: true,
          photos:        activityPhotos,
        },
      } as MagazineArticle;
    });
}

/** Listado de magazine_issues publicados. */
export async function getPublishedMagazineIssues(): Promise<MagazineIssue[]> {
  const { data, error } = await supabaseAdmin
    .from('magazine_issues')
    .select('*')
    .eq('status', 'publicado')
    .order('published_at', { ascending: false });

  if (error || !data) return [];
  return data as MagazineIssue[];
}

/** Detalle de una edición de la Revista con sus artículos. */
export async function getMagazineIssueById(id: string): Promise<{
  issue:    MagazineIssue;
  articles: MagazineArticle[];
} | null> {
  const { data: issue, error } = await supabaseAdmin
    .from('magazine_issues')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error || !issue) return null;

  const activityIds = (issue.activity_ids ?? []) as string[];
  if (activityIds.length === 0) return { issue: issue as MagazineIssue, articles: [] };

  const [activitiesRes, narrativesRes, photosRes] = await Promise.all([
    supabaseAdmin.from('activities').select('*').in('id', activityIds),
    supabaseAdmin.from('activity_narratives').select('*').in('activity_id', activityIds).eq('status', 'aprobado'),
    supabaseAdmin.from('activity_photos').select('*').in('activity_id', activityIds)
      .order('featured', { ascending: false }).order('display_order', { ascending: true }),
  ]);

  const narrativeByActivity = new Map(
    (narrativesRes.data ?? []).map((n: { activity_id: string }) => [n.activity_id, n])
  );
  const photosByActivity = new Map<string, ActivityPhoto[]>();
  for (const p of (photosRes.data ?? []) as ActivityPhoto[]) {
    const list = photosByActivity.get(p.activity_id) ?? [];
    list.push(p);
    photosByActivity.set(p.activity_id, list);
  }

  const articles: MagazineArticle[] = (activitiesRes.data ?? [])
    .filter((a: Activity) => narrativeByActivity.has(a.id))
    .map((a: Activity) => {
      const activityPhotos = photosByActivity.get(a.id) ?? [];
      const cover = activityPhotos.find((p) => p.featured) ?? activityPhotos[0] ?? null;
      return {
        narrative: narrativeByActivity.get(a.id) as unknown as import('@/lib/types/bitacora').ActivityNarrative,
        activity:  { ...a, cover_photo: cover, has_narrative: true, photos: activityPhotos },
      } as MagazineArticle;
    });

  return { issue: issue as MagazineIssue, articles };
}

// ---------------------------------------------------------------------------
// Conteo de storage
// ---------------------------------------------------------------------------

/** Estima el uso del bucket activity-photos consultando storage.objects. */
export async function getStorageUsage(): Promise<{
  fileCount:  number;
  totalBytes: number;
}> {
  const { data, error } = await supabaseAdmin
    .schema('storage')
    .from('objects')
    .select('metadata')
    .eq('bucket_id', 'activity-photos');

  if (error || !data) return { fileCount: 0, totalBytes: 0 };

  const totalBytes = data.reduce((sum: number, obj: { metadata?: { size?: number } }) => {
    return sum + (obj.metadata?.size ?? 0);
  }, 0);

  return { fileCount: data.length, totalBytes };
}

// ---------------------------------------------------------------------------
// Tags disponibles (para filtros)
// ---------------------------------------------------------------------------

/** Devuelve todos los tags únicos de actividades publicadas. */
export async function getPublicTags(): Promise<string[]> {
  const { data, error } = await supabaseAdmin
    .from('activities')
    .select('tags')
    .eq('status', 'publicado');

  if (error || !data) return [];

  const tagSet = new Set<string>();
  for (const row of data as { tags: string[] }[]) {
    for (const tag of row.tags ?? []) tagSet.add(tag);
  }
  return Array.from(tagSet).sort();
}
