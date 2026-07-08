import type { MetadataRoute } from 'next';
import { supabaseAdmin }      from '@/lib/supabase-admin';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://aodeporte.com';
const LOCALES = ['es', 'en'] as const;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [];

  // Páginas estáticas
  const staticPaths = ['', '/bitacora', '/revista', '/login'];
  for (const locale of LOCALES) {
    for (const path of staticPaths) {
      entries.push({
        url:             `${APP_URL}/${locale}${path}`,
        lastModified:    new Date(),
        changeFrequency: path === '' ? 'weekly' : 'daily',
        priority:        path === '' ? 1.0 : 0.8,
      });
    }
  }

  // Actividades publicadas
  const { data: activities } = await supabaseAdmin
    .from('activities')
    .select('slug, updated_at')
    .eq('status', 'publicado')
    .order('updated_at', { ascending: false });

  for (const activity of (activities ?? [])) {
    for (const locale of LOCALES) {
      entries.push({
        url:             `${APP_URL}/${locale}/bitacora/${activity.slug}`,
        lastModified:    new Date(activity.updated_at),
        changeFrequency: 'monthly',
        priority:        0.7,
      });
    }
  }

  // Artículos de la Revista (narrativas aprobadas)
  const { data: narratives } = await supabaseAdmin
    .from('activity_narratives')
    .select('id, approved_at')
    .eq('status', 'aprobado')
    .order('approved_at', { ascending: false });

  for (const narrative of (narratives ?? [])) {
    for (const locale of LOCALES) {
      entries.push({
        url:             `${APP_URL}/${locale}/revista/${narrative.id}`,
        lastModified:    new Date(narrative.approved_at ?? new Date()),
        changeFrequency: 'monthly',
        priority:        0.7,
      });
    }
  }

  return entries;
}
