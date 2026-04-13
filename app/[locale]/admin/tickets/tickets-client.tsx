'use client';

import { useRef, useTransition, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { StatusBadge, PriorityBadge } from './ticket-badges';
import type { TicketFilters, TicketWithProfiles } from '@/lib/tickets/types';
import type { ProfileSummary } from '@/lib/rbac/types';

interface Props {
  tickets: TicketWithProfiles[];
  profiles: ProfileSummary[];
  initialFilters: TicketFilters;
}

export default function TicketsClient({ tickets, profiles, initialFilters }: Props) {
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
            Search
          </label>
          <input
            id="search"
            type="text"
            placeholder="Search by title…"
            value={filters.search ?? ''}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm w-52"
          />
        </div>

        {/* Status */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1" htmlFor="status">
            Status
          </label>
          <select
            id="status"
            value={filters.status ?? ''}
            onChange={(e) => handleSelect('status', e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">All statuses</option>
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>
        </div>

        {/* Priority */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1" htmlFor="priority">
            Priority
          </label>
          <select
            id="priority"
            value={filters.priority ?? ''}
            onChange={(e) => handleSelect('priority', e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">All priorities</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>

        {/* Assigned to */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1" htmlFor="assigned_to">
            Assigned to
          </label>
          <select
            id="assigned_to"
            value={filters.assigned_to ?? ''}
            onChange={(e) => handleSelect('assigned_to', e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">Anyone</option>
            <option value="unassigned">Unassigned</option>
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
            Clear filters
          </button>
        )}
      </div>

      {/* ── Table ───────────────────────────────────────────────────────── */}
      {tickets.length === 0 ? (
        <div className="rounded-lg border border-gray-200 py-16 text-center">
          <p className="text-gray-500 text-sm">No tickets match the current filters.</p>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="mt-2 text-sm text-blue-600 hover:text-blue-700"
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Title
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Priority
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Assigned to
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
                <th className="relative px-5 py-3">
                  <span className="sr-only">Open</span>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {tickets.map((ticket) => (
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
                        by {ticket.created_by_profile.first_name}{' '}
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
                      <span className="text-gray-400 italic">Unassigned</span>
                    )}
                  </td>
                  <td className="px-5 py-4 text-gray-400 whitespace-nowrap">
                    {new Date(ticket.created_at).toLocaleDateString('en-US', {
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
                      View →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-3 text-xs text-gray-400">
        {tickets.length} ticket{tickets.length !== 1 ? 's' : ''} shown
      </p>
    </div>
  );
}
