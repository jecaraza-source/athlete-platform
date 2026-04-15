'use client';

import { useMemo, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { setRolePermissions } from '../actions';
import type { Permission } from '@/lib/rbac/types';

// ---------------------------------------------------------------------------
// Permission grouping — add new entries here when permissions are added
// ---------------------------------------------------------------------------

const GROUPS: Record<string, string[]> = {
  Athletes:       ['view_athletes', 'create_athletes', 'edit_athletes', 'delete_athletes'],
  Calendar:       ['view_calendar', 'manage_calendar'],
  Administration: ['manage_users', 'manage_roles', 'manage_permissions'],
};

function buildGroups(
  permissions: Permission[],
  groupDescriptions: Record<string, string>,
  otherLabel: string,
  otherDesc: string,
): Array<{ name: string; description: string; perms: Permission[] }> {
  const knownNames = new Set(Object.values(GROUPS).flat());
  const result: Array<{ name: string; description: string; perms: Permission[] }> = [];

  for (const [groupName, names] of Object.entries(GROUPS)) {
    const perms = permissions.filter((p) => names.includes(p.name));
    if (perms.length > 0) {
      result.push({ name: groupName, description: groupDescriptions[groupName] ?? '', perms });
    }
  }

  const other = permissions.filter((p) => !knownNames.has(p.name));
  if (other.length > 0) {
    result.push({ name: otherLabel, description: otherDesc, perms: other });
  }

  return result;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PermissionsForm({
  roleId,
  allPermissions,
  assignedIds,
}: {
  roleId: string | number;
  allPermissions: Permission[];
  assignedIds: Set<string>;
}) {
  const t = useTranslations('admin.accessControl.roles');
  const tc = useTranslations('common');
  const [checked, setChecked]   = useState<Set<string>>(() => new Set(assignedIds));
  const [lastSaved, setLastSaved] = useState<Set<string>>(() => new Set(assignedIds));
  const [error, setError]       = useState<string | null>(null);
  const [success, setSuccess]   = useState(false);
  const [isPending, startTransition] = useTransition();

  const groupDescriptions: Record<string, string> = {
    Athletes:       t('groupAthletesDesc'),
    Calendar:       t('groupCalendarDesc'),
    Administration: t('groupAdministrationDesc'),
  };

  const groups = useMemo(
    () => buildGroups(allPermissions, groupDescriptions, t('groupOther'), t('groupOtherDesc')),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allPermissions]
  );

  // Track whether the form has unsaved changes
  const isDirty = useMemo(() => {
    if (checked.size !== lastSaved.size) return true;
    for (const id of checked) if (!lastSaved.has(id)) return true;
    return false;
  }, [checked, lastSaved]);

  function toggle(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
    setSuccess(false);
  }

  function toggleGroup(perms: Permission[], selectAll: boolean) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (selectAll) perms.forEach((p) => next.add(p.id));
      else           perms.forEach((p) => next.delete(p.id));
      return next;
    });
    setSuccess(false);
  }

  function handleSave() {
    startTransition(async () => {
      const fd = new FormData();
      checked.forEach((id) => fd.append('permission_id', id));
      const result = await setRolePermissions(roleId, fd);
      if (result.error) {
        setError(result.error);
        setSuccess(false);
      } else {
        setError(null);
        setSuccess(true);
        setLastSaved(new Set(checked));
      }
    });
  }

  return (
    <div>
      {/* Status messages */}
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700 flex items-center gap-2">
          <span>&#10003;</span> {t('permissionsSaved')}
        </div>
      )}

      {/* Permission groups */}
      {allPermissions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 px-6 py-10 text-center">
          <p className="text-sm font-medium text-gray-500">{t('noPermissionsYet')}</p>
          <p className="text-xs text-gray-400 mt-1">
            {t.rich('noPermissionsHint', {
              link: (chunks) => (
                <a href="/admin/access-control/permissions" className="text-violet-600 hover:underline">
                  {chunks}
                </a>
              ),
            })}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map(({ name, description, perms }) => {
            const groupChecked  = perms.filter((p) => checked.has(p.id)).length;
            const allSelected   = groupChecked === perms.length;
            const noneSelected  = groupChecked === 0;

            return (
              <div key={name} className="rounded-xl border border-gray-200 overflow-hidden">
                {/* Group header */}
                <div className="flex items-start justify-between px-5 py-3 bg-gray-50 border-b border-gray-100">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-gray-800">{name}</h3>
                      <span className="text-xs text-gray-400">
                        {groupChecked} / {perms.length}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">{description}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 mt-0.5">
                    <button
                      type="button"
                      onClick={() => toggleGroup(perms, true)}
                      disabled={allSelected || isPending}
                      className="text-xs font-medium text-violet-600 hover:text-violet-800 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      {t('allToggle')}
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleGroup(perms, false)}
                      disabled={noneSelected || isPending}
                      className="text-xs font-medium text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      {t('noneToggle')}
                    </button>
                  </div>
                </div>

                {/* Individual permissions */}
                <div className="divide-y divide-gray-100">
                  {perms.map((perm) => {
                    const isChecked = checked.has(perm.id);
                    return (
                      <label
                        key={perm.id}
                        className={`flex items-start gap-3 px-5 py-3 cursor-pointer transition-colors ${
                          isPending
                            ? 'opacity-50 pointer-events-none'
                            : isChecked
                            ? 'bg-violet-50/40 hover:bg-violet-50'
                            : 'hover:bg-gray-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="mt-0.5 h-4 w-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                          checked={isChecked}
                          onChange={() => toggle(perm.id)}
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-mono font-medium text-gray-900">{perm.name}</p>
                          {perm.description && (
                            <p className="text-xs text-gray-500 mt-0.5">{perm.description}</p>
                          )}
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Save bar */}
      {allPermissions.length > 0 && (
        <div className="mt-6 flex items-center gap-4">
          <button
            onClick={handleSave}
            disabled={isPending || !isDirty}
            className="rounded-lg bg-violet-600 px-5 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-40 transition-colors"
          >
            {isPending ? tc('saving') : t('savePermissions')}
          </button>

          {isDirty && !isPending && (
            <span className="inline-flex items-center gap-1.5 text-xs text-amber-600">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" aria-hidden />
              {t('unsavedChanges')}
            </span>
          )}

          {!isDirty && !isPending && (
            <span className="text-xs text-gray-400">
              {t('permissionsSelectedCount', { selected: checked.size, total: allPermissions.length })}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
