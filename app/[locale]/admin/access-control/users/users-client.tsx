'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import UserRoleRow from './user-role-row';
import type { ProfileWithRoles, Role } from '@/lib/rbac/types';

// ---------------------------------------------------------------------------
// StatCard
// ---------------------------------------------------------------------------

function StatCard({
  value,
  label,
  color,
}: {
  value: number;
  label: string;
  color: 'gray' | 'violet' | 'amber';
}) {
  const styles = {
    gray:   { card: 'border-gray-200 bg-gray-50',     num: 'text-gray-800',   lbl: 'text-gray-500' },
    violet: { card: 'border-violet-200 bg-violet-50', num: 'text-violet-700', lbl: 'text-violet-600' },
    amber:  { card: 'border-amber-200 bg-amber-50',   num: 'text-amber-700',  lbl: 'text-amber-600' },
  }[color];

  return (
    <div className={`rounded-xl border p-5 ${styles.card}`}>
      <p className={`text-3xl font-bold ${styles.num}`}>{value}</p>
      <p className={`mt-0.5 text-sm font-medium ${styles.lbl}`}>{label}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// UsersClient
// ---------------------------------------------------------------------------

export default function UsersClient({
  profiles,
  allRoles,
  canDelete = false,
  currentProfileId = null,
}: {
  profiles: ProfileWithRoles[];
  allRoles: Role[];
  /** True when the logged-in user is a super_admin. */
  canDelete?: boolean;
  /** Profile ID of the logged-in user, used to mark the self-row. */
  currentProfileId?: string | null;
}) {
  const t = useTranslations('admin.accessControl.usersAndRoles');
  const tc = useTranslations('common');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  // Derived stats (computed from original profiles list, not filtered)
  const withRoles    = profiles.filter((p) => p.roles.length > 0).length;
  const withoutRoles = profiles.length - withRoles;

  // Filtered list
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return profiles.filter((p) => {
      const matchesSearch =
        !q ||
        `${p.first_name} ${p.last_name}`.toLowerCase().includes(q) ||
        (p.email ?? '').toLowerCase().includes(q);
      // roleFilter is a string from <select> value; role.id is now a number
      const matchesRole =
        !roleFilter || p.roles.some((r) => r.id === Number(roleFilter));
      return matchesSearch && matchesRole;
    });
  }, [profiles, search, roleFilter]);

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard value={profiles.length} label={t('totalUsers')}   color="gray"   />
        <StatCard value={withRoles}        label={t('withRoles')}    color="violet" />
        <StatCard value={withoutRoles}     label={t('withoutRoles')} color="amber"  />
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-gray-400 text-sm">
            &#128269;
          </span>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          placeholder={t('searchPlaceholder')}
          className="w-full rounded-lg border border-gray-300 pl-8 pr-3 py-2 text-sm placeholder:text-gray-400 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
          />
        </div>

        {/* Role filter */}
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 bg-white"
        >
          <option value="">{t('allRoles')}</option>
          {allRoles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}  {/* already human-readable from DB */}
            </option>
          ))}
        </select>

        {/* Clear filters */}
        {(search || roleFilter) && (
          <button
            onClick={() => { setSearch(''); setRoleFilter(''); }}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-500 hover:bg-gray-50 transition-colors whitespace-nowrap"
          >
            {tc('clearFilters')}
          </button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-5 py-3 font-semibold text-gray-700">{t('columnUser')}</th>
              <th className="text-left px-5 py-3 font-semibold text-gray-700">{t('columnAssignedRoles')}</th>
              <th className="text-left px-5 py-3 font-semibold text-gray-700">{t('columnAddRole')}</th>
              {canDelete && <th className="px-5 py-3" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map((profile) => (
              <UserRoleRow
                key={profile.id}
                profile={profile}
                allRoles={allRoles}
                canDelete={canDelete}
                isSelf={profile.id === currentProfileId}
              />
            ))}

            {filtered.length === 0 && (
              <tr>
                <td colSpan={canDelete ? 4 : 3} className="px-5 py-12 text-center">
                  {profiles.length === 0 ? (
                    <p className="text-gray-400 text-sm">{t('noUsersDB')}</p>
                  ) : (
                    <div className="space-y-1">
                      <p className="text-gray-500 font-medium text-sm">{t('noUsersFiltered')}</p>
                      <p className="text-gray-400 text-xs">
                        {t('tryAdjusting')}
                      </p>
                    </div>
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Table footer — result count */}
        {filtered.length > 0 && filtered.length < profiles.length && (
          <div className="border-t border-gray-100 bg-gray-50 px-5 py-2.5 text-xs text-gray-500">
            {t('showing', { shown: filtered.length, total: profiles.length })}
          </div>
        )}
      </div>
    </div>
  );
}
