'use client';

import { useRef, useTransition, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { StatusBadge, PriorityBadge } from './ticket-badges';
import type { TicketFilters, TicketWithProfiles } from '@/lib/tickets/types';
import type { ProfileSummary } from '@/lib/rbac/types';
import Pagination from '@/components/pagination';

const PER_PAGE = 25;

interface Props {
  tickets: TicketWithProfiles[];
  profiles: ProfileSummary[];
  initialFilters: TicketFilters;
  page: number;
}

export default function TicketsClient({ tickets, profiles, initialFilters, page }: Props) {
  const totalPages = Math.ceil(tickets.length / PER_PAGE);
  const paginated  = tickets.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const t = useTranslations('admin.tickets');
  const tc = useTranslations('common');
  // Mirror filter state locally so inputs are controlled after navigation
  const [filters, setFilters] = useState<TicketFilters>(initialFilters);
  const [, startTransition] = useTransition();
  const router = useRouter();
  const pathname = usePathname();
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function navigate(newFilters: TicketFilters) {
    const params = new URLSearchParams();
    if (newFilters.status)      params.set('status',      newFilters.status);
    if (newFilters.priority)    params.set('priority',    newFilters.priority);
    if (newFilters.assigned_to) params.set('assigned_to', newFilters.assigned_to);
    if (newFilters.search)      params.set('search',      newFilters.search);
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  function handleSelect(key: keyof TicketFilters, value: string) {
    const next = { ...filters, [key]: value };
    setFilters(next);
    navigate(next);
  }

  function handleSearchChange(value: string) {
    const next = { ...filters, search: value };
    setFilters(next);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => navigate(next), 400);
  }

  function clearFilters() {
    const empty: TicketFilters = {};
    setFilters(empty);
    navigate(empty);
  }

  const hasActiveFilters =
    !!filters.status || !!filters.priority || !!filters.assigned_to || !!filters.search;

  return (
    <div>
      {/* ── Filters ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-4 mb-6 items-end">
        {/* Search */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1" htmlFor="search">
            {t('searchLabel')}
          </label>
          <input
            id="search"
            type="text"
            placeholder={t('searchPlaceholder')}
            value={filters.search ?? ''}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm w-52"
          />
        </div>

        {/* Status */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1" htmlFor="status">
            {t('statusLabel')}
          </label>
          <select
            id="status"
            value={filters.status ?? ''}
            onChange={(e) => handleSelect('status', e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">{t('allStatuses')}</option>
            <option value="open">{t('statusOpen')}</option>
            <option value="in_progress">{t('statusInProgress')}</option>
            <option value="resolved">{t('statusResolved')}</option>
            <option value="closed">{t('statusClosed')}</option>
          </select>
        </div>

        {/* Priority */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1" htmlFor="priority">
            {t('priorityLabel')}
          </label>
          <select
            id="priority"
            value={filters.priority ?? ''}
            onChange={(e) => handleSelect('priority', e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">{t('allPriorities')}</option>
            <option value="low">{t('priorityLow')}</option>
            <option value="medium">{t('priorityMedium')}</option>
            <option value="high">{t('priorityHigh')}</option>
            <option value="urgent">{t('priorityUrgent')}</option>
          </select>
        </div>

        {/* Assigned to */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1" htmlFor="assigned_to">
            {t('assignedToLabel')}
          </label>
          <select
            id="assigned_to"
            value={filters.assigned_to ?? ''}
            onChange={(e) => handleSelect('assigned_to', e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">{t('anyoneOption')}</option>
            <option value="unassigned">{t('unassigned')}</option>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.first_name} {p.last_name}
              </option>
            ))}
          </select>
        </div>

        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="text-sm text-gray-500 hover:text-gray-700 underline self-end pb-2"
          >
            {tc('clearFilters')}
          </button>
        )}
      </div>

      {/* ── Table ───────────────────────────────────────────────────────── */}
      {tickets.length === 0 ? (
        <div className="rounded-lg border border-gray-200 py-16 text-center">
        <p className="text-gray-500 text-sm">{t('noMatch')}</p>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="mt-2 text-sm text-blue-600 hover:text-blue-700"
            >
              {tc('clearFilters')}
            </button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('columnTitle')}
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('columnStatus')}
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('columnPriority')}
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('columnAssignedTo')}
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('columnCreated')}
                </th>
                <th className="relative px-5 py-3">
                  <span className="sr-only">Open</span>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {paginated.map((ticket) => (
                <tr key={ticket.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-4 max-w-xs">
                    <Link
                      href={`/admin/tickets/${ticket.id}`}
                      className="font-medium text-gray-900 hover:text-rose-700 line-clamp-1"
                    >
                      {ticket.title}
                    </Link>
                    {ticket.created_by_profile && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        {t('ticketBy')} {ticket.created_by_profile.first_name}{' '}
                        {ticket.created_by_profile.last_name}
                      </p>
                    )}
                  </td>
                  <td className="px-5 py-4 whitespace-nowrap">
                    <StatusBadge status={ticket.status} />
                  </td>
                  <td className="px-5 py-4 whitespace-nowrap">
                    <PriorityBadge priority={ticket.priority} />
                  </td>
                  <td className="px-5 py-4 text-gray-600 whitespace-nowrap">
                    {ticket.assigned_to_profile ? (
                      <>
                        {ticket.assigned_to_profile.first_name}{' '}
                        {ticket.assigned_to_profile.last_name}
                      </>
                    ) : (
                      <span className="text-gray-400 italic">{t('unassigned')}</span>
                    )}
                  </td>
                  <td className="px-5 py-4 text-gray-400 whitespace-nowrap">
                  {new Date(ticket.created_at).toLocaleDateString(undefined, {
                    month: 'short',
                    day:   'numeric',
                    year:  'numeric',
                  })}
                  </td>
                  <td className="px-5 py-4 text-right whitespace-nowrap">
                    <Link
                      href={`/admin/tickets/${ticket.id}`}
                      className="text-xs font-medium text-rose-600 hover:text-rose-700"
                    >
                      {t('viewTicket')}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-3 flex items-center justify-between">
        <p className="text-xs text-gray-400">
          {t('count', { count: tickets.length })}
        </p>
        <Pagination page={page} totalPages={totalPages} pageParam="page" />
      </div>
    </div>
  );
}
