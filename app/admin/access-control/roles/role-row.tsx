'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { deleteRole } from './actions';
import type { Role } from '@/lib/rbac/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** "super_admin" → "Super Admin" */
function formatName(name: string) {
  return name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

const ROLE_DOT: Record<string, string> = {
  super_admin: 'bg-red-500',
  admin:       'bg-indigo-500',
  coach:       'bg-blue-500',
  staff:       'bg-amber-500',
  athlete:     'bg-teal-500',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function RoleRow({
  role,
  permissionCount,
  userCount,
}: {
  role: Role;
  permissionCount: number;
  userCount: number;
}) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteRole(role.id);
      if (result.error) {
        setError(result.error);
        setConfirming(false);
      }
    });
  }

  const dotColor = ROLE_DOT[role.code] ?? 'bg-gray-400';

  return (
    <tr className={`transition-colors ${
      isPending ? 'opacity-50 pointer-events-none' : 'hover:bg-gray-50/60'
    }`}>
      {/* Name */}
      <td className="px-5 py-4">
        <div className="flex items-center gap-3">
          <span className={`shrink-0 w-2.5 h-2.5 rounded-full ${dotColor}`} aria-hidden />
          <div>
          <p className="font-semibold text-sm text-gray-900">{role.name}</p>
            <p className="font-mono text-xs text-gray-400 mt-0.5">{role.code}</p>
          </div>
        </div>
      </td>

      {/* Description */}
      <td className="px-5 py-4 text-gray-500 text-sm max-w-xs">
        {role.description ?? <span className="italic text-gray-300">No description</span>}
      </td>

      {/* Type badge */}
      <td className="px-5 py-4 text-center">
        {role.is_system ? (
          <span className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 ring-1 ring-gray-200">
            System
          </span>
        ) : (
          <span className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full bg-white text-gray-400 ring-1 ring-gray-200">
            Custom
          </span>
        )}
      </td>

      {/* Permission count */}
      <td className="px-5 py-4 text-center">
        <span className="inline-block min-w-[2rem] text-center text-xs font-semibold text-violet-700 bg-violet-100 px-2 py-1 rounded-full">
          {permissionCount}
        </span>
      </td>

      {/* User count */}
      <td className="px-5 py-4 text-center">
        <span className="inline-block min-w-[2rem] text-center text-xs font-semibold text-emerald-700 bg-emerald-100 px-2 py-1 rounded-full">
          {userCount}
        </span>
      </td>

      {/* Actions */}
      <td className="px-5 py-4 text-right">
        <div className="flex items-center justify-end gap-3">
          {error && (
            <span className="text-xs text-red-600 max-w-[12rem] truncate" title={error}>
              {error}
            </span>
          )}

          <Link
            href={`/admin/access-control/roles/${role.id}`}
            className="text-xs font-medium text-violet-600 hover:text-violet-800 hover:underline"
          >
            Manage
          </Link>

          {!confirming ? (
            <button
              onClick={() => setConfirming(true)}
              disabled={role.is_system}
              className="text-xs text-red-400 hover:text-red-600 hover:underline disabled:opacity-25 disabled:cursor-not-allowed"
              title={role.is_system ? 'System roles cannot be deleted' : 'Delete role'}
            >
              Delete
            </button>
          ) : (
            <span className="flex items-center gap-1.5 text-xs">
              <span className="text-gray-500">Delete?</span>
              <button
                onClick={handleDelete}
                disabled={isPending}
                className="text-red-600 font-semibold hover:underline disabled:opacity-50"
              >
                {isPending ? 'Deleting…' : 'Yes'}
              </button>
              <button
                onClick={() => setConfirming(false)}
                className="text-gray-400 hover:text-gray-600 hover:underline"
              >
                No
              </button>
            </span>
          )}
        </div>
      </td>
    </tr>
  );
}
