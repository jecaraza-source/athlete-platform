import { notFound } from 'next/navigation';
import BackButton from '@/components/back-button';
import { requireAdminAccess, getAllPermissions, getRoleWithPermissions } from '@/lib/rbac/server';
import type { Permission } from '@/lib/rbac/types';
import EditRoleForm from './edit-role-form';
import PermissionsForm from './permissions-form';

export const dynamic = 'force-dynamic';

// Role identity colors
const ROLE_COLORS: Record<string, { dot: string; badge: string; text: string }> = {
  super_admin: { dot: 'bg-red-500',    badge: 'bg-red-100 ring-red-200',    text: 'text-red-700' },
  admin:       { dot: 'bg-indigo-500', badge: 'bg-indigo-100 ring-indigo-200', text: 'text-indigo-700' },
  coach:       { dot: 'bg-blue-500',   badge: 'bg-blue-100 ring-blue-200',   text: 'text-blue-700' },
  staff:       { dot: 'bg-amber-500',  badge: 'bg-amber-100 ring-amber-200',  text: 'text-amber-700' },
  athlete:     { dot: 'bg-teal-500',   badge: 'bg-teal-100 ring-teal-200',   text: 'text-teal-700' },
};
const DEFAULT_COLORS = { dot: 'bg-gray-400', badge: 'bg-gray-100 ring-gray-200', text: 'text-gray-600' };

function formatName(name: string) {
  return name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export default async function RoleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdminAccess();

  const { id } = await params;
  const [roleWithPerms, allPermissions] = await Promise.all([
    getRoleWithPermissions(id),
    getAllPermissions(),
  ]);

  if (!roleWithPerms) notFound();

  const assignedIds = new Set<string>(roleWithPerms.permissions.map((p: Permission) => p.id));
  const colors = ROLE_COLORS[roleWithPerms.name] ?? DEFAULT_COLORS;

  return (
    <main className="p-8 max-w-3xl">
      <BackButton href="/admin/access-control/roles" label="Back to Roles" />

      {/* Header */}
      <div className="mt-5 mb-8 flex items-start gap-4">
        <span className={`mt-1 shrink-0 w-3 h-3 rounded-full ${colors.dot}`} aria-hidden />
        <div className="min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-gray-900">{formatName(roleWithPerms.name)}</h1>
            <span
              className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full ring-1 ${colors.badge} ${colors.text}`}
            >
              {roleWithPerms.is_system ? 'System role' : 'Custom role'}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-3 text-xs text-gray-400">
            <span className="font-mono">{roleWithPerms.name}</span>
            <span aria-hidden>·</span>
            <span>Created {formatDate(roleWithPerms.created_at)}</span>
            <span aria-hidden>·</span>
            <span>{assignedIds.size} permission{assignedIds.size !== 1 ? 's' : ''} assigned</span>
          </div>
        </div>
      </div>

      <div className="space-y-10">
        {/* Details */}
        <section>
          <div className="mb-4">
            <h2 className="text-base font-semibold text-gray-900">Details</h2>
            <p className="text-sm text-gray-500 mt-0.5">Update the description for this role.</p>
          </div>
          <EditRoleForm role={roleWithPerms} />
        </section>

        {/* Permissions */}
        <section>
          <div className="mb-4">
            <h2 className="text-base font-semibold text-gray-900">Permissions</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Select which permissions this role grants. Permissions are grouped by area.
            </p>
          </div>
          <PermissionsForm
            roleId={roleWithPerms.id}
            allPermissions={allPermissions}
            assignedIds={assignedIds}
          />
        </section>
      </div>
    </main>
  );
}
