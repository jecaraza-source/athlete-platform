'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { deletePermission } from './actions';
import type { Permission } from '@/lib/rbac/types';

type RoleRef = { id: string; name: string };

const ROLE_BADGE_COLORS: Record<string, string> = {
  super_admin: 'bg-red-100 text-red-700 ring-red-200',
  admin:       'bg-indigo-100 text-indigo-700 ring-indigo-200',
  coach:       'bg-blue-100 text-blue-700 ring-blue-200',
  staff:       'bg-amber-100 text-amber-700 ring-amber-200',
  athlete:     'bg-teal-100 text-teal-700 ring-teal-200',
};

function formatRoleName(name: string) {
  return name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function PermissionRow({
  permission,
  roles,
}: {
  permission: Permission;
  roles: RoleRef[];
}) {
  const t = useTranslations('admin.accessControl.permissions');
  const tc = useTranslations('common');
  const [confirming, setConfirming] = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      const result = await deletePermission(permission.id);
      if (result.error) {
        setError(result.error);
        setConfirming(false);
      }
    });
  }

  return (
    <tr className={`transition-colors ${
      isPending ? 'opacity-50 pointer-events-none' : 'hover:bg-gray-50/60'
    }`}>
      {/* Name */}
      <td className="px-5 py-4">
        <p className="font-mono text-sm font-semibold text-gray-900">{permission.name}</p>
      </td>

      {/* Description */}
      <td className="px-5 py-4 text-gray-500 text-sm max-w-xs">
      {permission.description ?? (
          <span className="italic text-gray-300">{tc('noDescription')}</span>
        )}
      </td>

      {/* Role badges */}
      <td className="px-5 py-4">
        {roles.length === 0 ? (
          <span className="text-xs italic text-gray-300">{t('unused')}</span>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {roles.map((role) => (
              <Link
                key={role.id}
                href={`/admin/access-control/roles/${role.id}`}
                className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full ring-1 hover:opacity-80 transition-opacity ${
                  ROLE_BADGE_COLORS[role.name] ?? 'bg-gray-100 text-gray-600 ring-gray-200'
                }`}
              >
              {role.name}  {/* already human-readable from DB */}
              </Link>
            ))}
          </div>
        )}
      </td>

      {/* Actions */}
      <td className="px-5 py-4 text-right">
        <div className="flex items-center justify-end gap-3">
          {error && (
            <span className="text-xs text-red-600 max-w-[12rem] truncate" title={error}>
              {error}
            </span>
          )}

          {!confirming ? (
            <button
              onClick={() => setConfirming(true)}
              className="text-xs text-red-400 hover:text-red-600 hover:underline"
            >
              {tc('delete')}
            </button>
          ) : (
            <span className="flex items-center gap-1.5 text-xs">
              <span className="text-gray-500">{tc('deleteConfirm')}</span>
              <button
                onClick={handleDelete}
                disabled={isPending}
                className="text-red-600 font-semibold hover:underline disabled:opacity-50"
              >
                {isPending ? tc('deleting') : tc('yes')}
              </button>
              <button
                onClick={() => setConfirming(false)}
                className="text-gray-400 hover:text-gray-600 hover:underline"
              >
                {tc('no')}
              </button>
            </span>
          )}
        </div>
      </td>
    </tr>
  );
}
