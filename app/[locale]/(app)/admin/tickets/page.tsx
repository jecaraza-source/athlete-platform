import Link from 'next/link';
import BackButton from '@/components/back-button';
import { requirePermission } from '@/lib/rbac/server';
import { getTickets, getAllProfiles } from '@/lib/tickets/queries';
import type { TicketFilters } from '@/lib/tickets/types';
import { getTranslations } from 'next-intl/server';
import TicketsClient from './tickets-client';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function TicketsPage({ searchParams }: PageProps) {
  await requirePermission('view_tickets');

  const params = await searchParams;

  const filters: TicketFilters = {
    status:      (params.status      as string) || undefined,
    priority:    (params.priority    as string) || undefined,
    assigned_to: (params.assigned_to as string) || undefined,
    search:      (params.search      as string) || undefined,
  };

  const page = Math.max(1, parseInt((params.page as string) || '1', 10));

  const [tickets, profiles] = await Promise.all([
    getTickets(filters),
    getAllProfiles(),
  ]);

  const t = await getTranslations('admin.tickets');
  const tc = await getTranslations('common');

  return (
    <main className="p-8">
      <BackButton href="/admin" label={tc('backToAdmin')} />

      <div className="flex items-start justify-between mt-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-rose-700">{t('title')}</h1>
          <p className="text-gray-500 mt-1 text-sm">
            {t('description')}
          </p>
        </div>
        <Link
          href="/admin/tickets/new"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          {t('newTicket')}
        </Link>
      </div>

      <TicketsClient
        tickets={tickets}
        profiles={profiles}
        initialFilters={filters}
        page={page}
      />
    </main>
  );
}
