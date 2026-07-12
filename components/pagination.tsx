'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';

interface PaginationProps {
  page: number;
  totalPages: number;
  /** Total items — shown as contextual info */
  totalItems?: number;
  /** URL param name for page (default: 'page') */
  pageParam?: string;
}

export default function Pagination({
  page,
  totalPages,
  totalItems,
  pageParam = 'page',
}: PaginationProps) {
  const tc       = useTranslations('common');
  const router   = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (totalPages <= 1) return null;

  function go(target: number) {
    const params = new URLSearchParams(searchParams.toString());
    if (target === 1) {
      params.delete(pageParam);
    } else {
      params.set(pageParam, String(target));
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
      <span>
        {tc('paginationPage')} {page} {tc('paginationOf')} {totalPages}
        {totalItems !== undefined && (
          <span className="ml-1 text-gray-400">({totalItems})</span>
        )}
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => go(page - 1)}
          disabled={page <= 1}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {tc('paginationPrev')}
        </button>
        <button
          type="button"
          onClick={() => go(page + 1)}
          disabled={page >= totalPages}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {tc('paginationNext')}
        </button>
      </div>
    </div>
  );
}
