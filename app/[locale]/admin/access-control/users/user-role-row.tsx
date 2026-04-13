'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { assignRole, revokeRole, deleteUser } from './actions';
import type { ProfileWithRoles, Role } from '@/lib/rbac/types';
import ChangePasswordForm from './change-password-form';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** "super_admin" → "Super Admin" */
function formatRoleName(name: string): string {
  return name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// Keys are role.code (snake_case slugs), not role.name (display labels)
const BADGE_COLORS: Record<string, string> = {
  super_admin:      'bg-red-100 text-red-700 ring-red-200',
  admin:            'bg-indigo-100 text-indigo-700 ring-indigo-200',
  program_director: 'bg-indigo-100 text-indigo-700 ring-indigo-200',
  coach:            'bg-blue-100 text-blue-700 ring-blue-200',
  staff:            'bg-amber-100 text-amber-700 ring-amber-200',
  physio:           'bg-orange-100 text-orange-700 ring-orange-200',
  nutritionist:     'bg-green-100 text-green-700 ring-green-200',
  psychologist:     'bg-purple-100 text-purple-700 ring-purple-200',
  medic:            'bg-rose-100 text-rose-700 ring-rose-200',
  event_coordinator:'bg-sky-100 text-sky-700 ring-sky-200',
  guardian:         'bg-gray-100 text-gray-600 ring-gray-200',
  athlete:          'bg-teal-100 text-teal-700 ring-teal-200',
};

const AVATAR_PALETTES = [
  'bg-violet-100 text-violet-700',
  'bg-sky-100 text-sky-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700',
  'bg-cyan-100 text-cyan-700',
  'bg-indigo-100 text-indigo-700',
  'bg-fuchsia-100 text-fuchsia-700',
];

function avatarColor(name: string): string {
  const hash = Array.from(name).reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return AVATAR_PALETTES[hash % AVATAR_PALETTES.length];
}

function initials(first: string, last: string): string {
  return `${first[0] ?? ''}${last[0] ?? ''}`.toUpperCase();
}

// ---------------------------------------------------------------------------
// RoleBadge — individual badge with inline revoke confirmation
// ---------------------------------------------------------------------------

function RoleBadge({
  role,
  onRevoke,
  disabled,
}: {
  role: Role;
  onRevoke: (id: number) => void;
  disabled: boolean;
}) {
  const t = useTranslations('admin.accessControl.usersAndRoles');
  const tc = useTranslations('common');
  const [confirming, setConfirming] = useState(false);
  const color = BADGE_COLORS[role.code] ?? 'bg-gray-100 text-gray-600 ring-gray-200';

  if (confirming) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-red-50 text-red-700 ring-1 ring-red-200">
        {t('removeConfirm', { name: role.name })}
        <button
          onClick={() => { onRevoke(role.id); setConfirming(false); }}
          disabled={disabled}
          className="font-semibold underline hover:no-underline disabled:opacity-50"
        >
          {tc('yes')}
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="opacity-60 hover:opacity-100"
        >
          ✕
        </button>
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ring-1 ${color}`}
    >
      {role.name}  {/* already human-readable from DB */}
      <button
        onClick={() => setConfirming(true)}
        disabled={disabled}
        className="ml-0.5 opacity-50 hover:opacity-100 disabled:cursor-not-allowed transition-opacity"
        title={`Remove ${role.name}`}
          aria-label={`Remove ${role.name}`}
      >
        ✕
      </button>
    </span>
  );
}

// ---------------------------------------------------------------------------
// AddRoleControl — dropdown + Assign button, hidden until "+" is clicked
// ---------------------------------------------------------------------------

function AddRoleControl({
  availableRoles,
  onAssign,
  disabled,
}: {
  availableRoles: Role[];
  onAssign: (roleId: string) => void;
  disabled: boolean;
}) {
  const t = useTranslations('admin.accessControl.usersAndRoles');
  const tc = useTranslations('common');
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState('');

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 text-xs font-medium text-violet-600 hover:text-violet-800 border border-dashed border-violet-300 hover:border-violet-500 px-2 py-0.5 rounded-full transition-colors"
      >
        {t('addRole')}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <select
        autoFocus
        value={selectedId}
        onChange={(e) => setSelectedId(e.target.value)}
        className="rounded-md border border-gray-300 px-2 py-1 text-xs focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
      >
        <option value="">{t('pickRole')}</option>
          {availableRoles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}  {/* already human-readable from DB */}
            </option>
          ))}
      </select>
      <button
        onClick={() => {
          if (selectedId) { onAssign(selectedId); setOpen(false); setSelectedId(''); }
        }}
        disabled={!selectedId || disabled}
        className="rounded-md bg-violet-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-violet-700 disabled:opacity-40 transition-colors"
      >
        {t('assign')}
      </button>
      <button
        onClick={() => { setOpen(false); setSelectedId(''); }}
        className="text-xs text-gray-400 hover:text-gray-600 px-1"
      >
        {tc('cancel')}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// UserRoleRow
// ---------------------------------------------------------------------------

export default function UserRoleRow({
  profile,
  allRoles,
  canDelete = false,
  isSelf = false,
}: {
  profile: ProfileWithRoles;
  allRoles: Role[];
  /** True when the logged-in user is a super_admin. */
  canDelete?: boolean;
  /** True when this row represents the currently logged-in user. */
  isSelf?: boolean;
}) {
  const t = useTranslations('admin.accessControl.usersAndRoles');
  const tc = useTranslations('common');
  const [assignedRoles, setAssignedRoles]   = useState<Role[]>(profile.roles);
  const [error, setError]                   = useState<string | null>(null);
  const [isPending, startTransition]        = useTransition();
  const [deleted, setDeleted]               = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteError, setDeleteError]       = useState<string | null>(null);

  // Row has been deleted — hide it without a full page refresh
  if (deleted) return null;

  function handleDelete() {
    if (!profile.auth_user_id) return;
    startTransition(async () => {
      const result = await deleteUser(profile.id, profile.auth_user_id!);
      if (result.error) {
        setDeleteError(result.error);
        setConfirmingDelete(false);
      } else {
        setDeleted(true);
      }
    });
  }

  const assignedIds = new Set(assignedRoles.map((r) => r.id));
  const availableRoles = allRoles.filter((r) => !assignedIds.has(r.id));

  // roleId comes as a string from the <select> DOM element; convert to number
  // to match the integer PK used in the existing roles table.
  function handleAssign(roleId: string) {
    const numId = Number(roleId);
    const role = allRoles.find((r) => r.id === numId);
    if (!role) return;
    startTransition(async () => {
      const result = await assignRole(profile.id, roleId);
      if (result.error) {
        setError(result.error);
      } else {
        setError(null);
        setAssignedRoles((prev) => [...prev, role]);
      }
    });
  }

  function handleRevoke(roleId: number) {
    startTransition(async () => {
      const result = await revokeRole(profile.id, String(roleId));
      if (result.error) {
        setError(result.error);
      } else {
        setError(null);
        setAssignedRoles((prev) => prev.filter((r) => r.id !== roleId));
      }
    });
  }

  const fullName = `${profile.first_name} ${profile.last_name}`;
  const avatarCls = avatarColor(fullName);

  return (
    <tr className={`align-middle transition-colors ${
      isPending ? 'opacity-60 pointer-events-none bg-gray-50' : 'hover:bg-gray-50/70'
    }`}>
      {/* Avatar + Name + Email */}
      <td className="px-5 py-3.5">
        <div className="flex items-center gap-3">
          <span
            className={`shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-semibold ${avatarCls}`}
            aria-hidden
          >
            {initials(profile.first_name, profile.last_name)}
          </span>
          <div className="min-w-0">
            <p className="font-medium text-gray-900 truncate">{fullName}</p>
            <p className="text-xs text-gray-400 truncate">
            {profile.email ?? <span className="italic">{t('noEmail')}</span>}
            </p>
            {profile.auth_user_id && (
              <ChangePasswordForm authUserId={profile.auth_user_id} />
            )}
          </div>
        </div>
      </td>

      {/* Assigned roles */}
      <td className="px-5 py-3.5">
        <div className="flex flex-wrap items-center gap-1.5">
          {assignedRoles.length === 0 ? (
            <span className="text-xs text-gray-400 italic">{t('noRolesAssigned')}</span>
          ) : (
            assignedRoles.map((role) => (
              <RoleBadge
                key={role.id}
                role={role}
                onRevoke={handleRevoke}
                disabled={isPending}
              />
            ))
          )}
        </div>
        {error && (
          <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1">
            <span aria-hidden>⚠</span> {error}
          </p>
        )}
      </td>

      {/* Add role */}
      <td className="px-5 py-3.5">
        {isPending ? (
          <span className="text-xs text-gray-400">{tc('saving')}</span>
        ) : availableRoles.length > 0 ? (
          <AddRoleControl
            availableRoles={availableRoles}
            onAssign={handleAssign}
            disabled={isPending}
          />
        ) : (
          <span className="text-xs text-gray-400 italic">{t('allRolesAssigned')}</span>
        )}
      </td>

      {/* Delete — only visible to super_admin */}
      {canDelete && (
        <td className="px-5 py-3.5 text-right">
          {deleteError && (
            <p className="mb-1 text-xs text-red-600" title={deleteError}>{deleteError}</p>
          )}
          {isSelf ? (
            <span className="text-xs text-gray-300 italic">{t('you')}</span>
          ) : !confirmingDelete ? (
            <button
              onClick={() => setConfirmingDelete(true)}
              disabled={!profile.auth_user_id}
              className="text-xs text-red-400 hover:text-red-600 hover:underline disabled:opacity-30 disabled:cursor-not-allowed"
              title={!profile.auth_user_id ? t('noAuthLinked') : t('deleteUserPermanently')}
            >
              {tc('delete')}
            </button>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-xs">
              <span className="text-gray-500">{tc('deleteConfirm')}</span>
              <button
                onClick={handleDelete}
                disabled={isPending}
                className="font-semibold text-red-600 hover:underline disabled:opacity-50"
              >
                {isPending ? tc('deleting') : tc('yes')}
              </button>
              <button
                onClick={() => { setConfirmingDelete(false); setDeleteError(null); }}
                className="text-gray-400 hover:text-gray-600 hover:underline"
              >
                {tc('no')}
              </button>
            </span>
          )}
        </td>
      )}
    </tr>
  );
}
