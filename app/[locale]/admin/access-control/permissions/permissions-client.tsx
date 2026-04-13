'use client';

import { useMemo, useState } from 'react';
import PermissionRow from './permission-row';
import type { Permission } from '@/lib/rbac/types';

type RoleRef = { id: string; name: string };

export default function PermissionsClient({
  permissions,
  rolesByPerm,
}: {
  permissions: Permission[];
  rolesByPerm: Record<string, RoleRef[]>;
}) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return permissions;
    return permissions.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.description ?? '').toLowerCase().includes(q)
    );
  }, [permissions, search]);

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-gray-400 text-sm">
          &#128269;
        </span>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or description…"
          className="w-full rounded-lg border border-gray-300 pl-8 pr-3 py-2 text-sm placeholder:text-gray-400 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
        />
      </div>

      {/* Table */}
      <div className="rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-5 py-3 font-semibold text-gray-700">Name</th>
              <th className="text-left px-5 py-3 font-semibold text-gray-700">Description</th>
              <th className="text-left px-5 py-3 font-semibold text-gray-700">Used by roles</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map((perm) => (
              <PermissionRow
                key={perm.id}
                permission={perm}
                roles={rolesByPerm[perm.id] ?? []}
              />
            ))}

            {filtered.length === 0 && (
              <tr>
                <td colSpan={4} className="px-5 py-12 text-center">
                  {permissions.length === 0 ? (
                    <p className="text-gray-400 text-sm">
                      No permissions yet. Click &quot;+ New permission&quot; to create the first one.
                    </p>
                  ) : (
                    <div className="space-y-1">
                      <p className="text-gray-500 font-medium text-sm">No permissions match your search.</p>
                      <p className="text-gray-400 text-xs">Try a different keyword.</p>
                    </div>
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {search && filtered.length > 0 && filtered.length < permissions.length && (
          <div className="border-t border-gray-100 bg-gray-50 px-5 py-2.5 text-xs text-gray-500">
            Showing {filtered.length} of {permissions.length} permissions
          </div>
        )}
      </div>
    </div>
  );
}
