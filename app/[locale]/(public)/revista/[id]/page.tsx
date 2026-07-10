import type { Metadata }         from 'next';
import { notFound }              from 'next/navigation';
import Link                      from 'next/link';
import { supabaseAdmin }         from '@/lib/supabase-admin';
import { getAdminActivityById }  from '@/lib/bitacora/queries';
import { MagazineArticle }       from '@/components/revista/MagazineArticle';
import { DeleteArticleButton }   from '@/components/revista/DeleteArticleButton';
import { getThumbnailUrl }       from '@/lib/storage-config';
import { getCurrentUser }        from '@/lib/rbac/server';
import type { MagazineArticle as MagazineArticleType, ActivityNarrative } from '@/lib/types/bitacora';

interface PageProps {
  params: Promise<{ locale: string; id: string }>;
}

async function getNarrativeWithActivity(narrativeId: string): Promise<MagazineArticleType | null> {
  const { data: narrative } = await supabaseAdmin
    .from('activity_narratives')
    .select('*')
    .eq('id', narrativeId)
    .eq('status', 'aprobado')
    .maybeSingle();

  if (!narrative) return null;

  const activity = await getAdminActivityById(narrative.activity_id);
  if (!activity || activity.status !== 'publicado') return null;

  const coverPhoto = activity.photos.find((p) => p.featured) ?? activity.photos[0] ?? null;

  return {
    narrative: narrative as ActivityNarrative,
    activity: {
      ...activity,
      cover_photo:   coverPhoto,
      has_narrative: true,
    },
  };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, id } = await params;
  const article = await getNarrativeWithActivity(id);

  if (!article) return { title: 'Artículo no encontrado — Revista AO Deporte' };

  const coverUrl = article.activity.cover_photo
    ? getThumbnailUrl(article.activity.cover_photo.storage_path)
    : undefined;
  const url = `https://aodeporte.com/${locale}/revista/${id}`;

  return {
    title:       `${article.activity.title} — Revista AO Deporte`,
    description: article.narrative.narrative_text.slice(0, 160),
    alternates:  { canonical: url },
    openGraph: {
      title:       article.activity.title,
      description: article.narrative.narrative_text.slice(0, 160),
      url,
      type:        'article',
      images:      coverUrl ? [{ url: coverUrl, alt: article.activity.title }] : undefined,
    },
    twitter: {
      card:        'summary_large_image',
      title:       article.activity.title,
      description: article.narrative.narrative_text.slice(0, 160),
      images:      coverUrl ? [coverUrl] : undefined,
    },
  };
}

export default async function RevistaArticlePage({ params }: PageProps) {
  const { locale, id } = await params;
  const [article, user] = await Promise.all([
    getNarrativeWithActivity(id),
    getCurrentUser(),
  ]);

  if (!article) notFound();

  const appUrl  = process.env.NEXT_PUBLIC_APP_URL ?? 'https://aodeporte.com';
  const isAdmin = user?.roles.some((r) =>
    ['super_admin', 'admin', 'program_director'].includes(r.code)
  ) ?? false;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <nav className="text-sm text-gray-400 mb-6">
        <Link href={`/${locale}/revista`} className="hover:text-red-600 transition-colors">
          ← Volver a la Revista
        </Link>
      </nav>

      <MagazineArticle
        article={article}
        appUrl={appUrl}
        deleteButton={
          isAdmin
            ? <DeleteArticleButton key="delete" narrativeId={article.narrative.id} locale={locale} />
            : undefined
        }
      />
    </div>
  );
}
