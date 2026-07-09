import Link from 'next/link';
import Image from 'next/image';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { MagazineIssue, MagazineArticle } from '@/lib/types/bitacora';
import { getThumbnailUrl } from '@/lib/storage-config';

interface MagazineIssueViewProps {
  issue:    MagazineIssue;
  articles: MagazineArticle[];
  locale:   string;
  appUrl:   string;
}

export function MagazineIssueView({ issue, articles, locale, appUrl }: MagazineIssueViewProps) {
  const periodLabel = issue.period_start && issue.period_end
    ? `${format(new Date(issue.period_start), 'MMMM', { locale: es })} — ${format(new Date(issue.period_end), 'MMMM yyyy', { locale: es })}`
    : issue.published_at
      ? format(new Date(issue.published_at), 'MMMM yyyy', { locale: es })
      : null;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header de edición */}
      <header className="text-center mb-10">
        <p className="text-xs font-bold uppercase tracking-widest text-red-600 mb-2">Revista AO Deporte</p>
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">{issue.title}</h1>
        {periodLabel && (
          <p className="text-gray-500 text-sm">{periodLabel}</p>
        )}
        <div className="mt-4 border-t-2 border-red-600 w-16 mx-auto" />
      </header>

      {/* Artículos */}
      <div className="flex flex-col gap-12">
        {articles.map((article, i) => (
          <ArticlePreview
            key={article.narrative.id}
            article={article}
            locale={locale}
            appUrl={appUrl}
            isFeatured={i === 0}
          />
        ))}
      </div>
    </div>
  );
}

function ArticlePreview({
  article,
  locale,
  appUrl,
  isFeatured,
}: {
  article:    MagazineArticle;
  locale:     string;
  appUrl:     string;
  isFeatured: boolean;
}) {
  const { activity, narrative } = article;
  const coverUrl = activity.cover_photo
    ? getThumbnailUrl(activity.cover_photo.storage_path)
    : null;

  const formattedDate = activity.event_date
    ? format(new Date(activity.event_date), "d 'de' MMMM yyyy", { locale: es })
    : null;

  // Extracto de la narrativa (~180 caracteres)
  const excerpt = narrative.narrative_text.slice(0, 180).trim() + '…';

  const href = `/${locale}/revista/${narrative.id}`;

  if (isFeatured) {
    return (
      <article className="grid sm:grid-cols-2 gap-6 items-start">
        {coverUrl && (
          <Link href={href} className="block relative w-full aspect-[4/3] rounded-xl overflow-hidden shadow-md">
            <Image src={coverUrl} alt={activity.title} fill sizes="(max-width: 640px) 100vw, 50vw" className="object-cover" />
          </Link>
        )}
        <div className="flex flex-col gap-3">
          {formattedDate && <time className="text-xs text-gray-400">{formattedDate}</time>}
          <h2 className="text-xl font-bold text-gray-900 leading-tight">
            <Link href={href} className="hover:text-red-600 transition-colors">{activity.title}</Link>
          </h2>
          <p className="text-gray-600 text-sm leading-relaxed">{excerpt}</p>
          <Link href={href} className="text-sm font-semibold text-red-600 hover:text-red-700">
            Leer artículo completo →
          </Link>
        </div>
      </article>
    );
  }

  return (
    <article className="flex gap-4 items-start border-t border-gray-100 pt-8">
      {coverUrl && (
        <Link href={href} className="relative w-28 h-20 shrink-0 rounded-lg overflow-hidden shadow-sm">
          <Image src={coverUrl} alt={activity.title} fill sizes="112px" className="object-cover" />
        </Link>
      )}
      <div className="flex flex-col gap-1">
        {formattedDate && <time className="text-xs text-gray-400">{formattedDate}</time>}
        <h2 className="font-semibold text-gray-900 leading-snug">
          <Link href={href} className="hover:text-red-600 transition-colors">{activity.title}</Link>
        </h2>
        <p className="text-sm text-gray-500 line-clamp-2">{excerpt}</p>
        <Link href={href} className="text-xs font-semibold text-red-600 hover:text-red-700 mt-0.5">
          Leer →
        </Link>
      </div>
    </article>
  );
}
