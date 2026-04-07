import BackButton from '@/components/back-button';
import { requireAdminAccess, getAllPermissions } from '@/lib/rbac/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import CreatePermissionForm from './create-permission-form';
import PermissionsClient from './permissions-client';

export const dynamic = 'force-dynamic';

export default async function PermissionsPage() {
  await requireAdminAccess();

  const permissions = await getAllPermissions();

  // Fetch role names used by each permission
  const { data: rpRows } = await supabaseAdmin
    .from('role_permissions')
    .select('permission_id, roles(id, name)');

  // Build permissionId → [{id, name}] map
  const rolesByPerm: Record<string, Array<{ id: string; name: string }>> = {};
  for (const rp of rpRows ?? []) {
    const role = Array.isArray(rp.roles) ? rp.roles[0] : rp.roles;
    if (!rp.permission_id || !role) continue;
    rolesByPerm[rp.permission_id] ??= [];
    rolesByPerm[rp.permission_id].push({ id: role.id, name: role.name });
  }

  return (
    <main className="p-8">
      <BackButton href="/admin/access-control" label="Back to Access Control" />

      <div className="flex items-start justify-between mt-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold">Permissions</h1>
          <p className="text-gray-500 mt-1 text-sm">
            {permissions.length} permission{permissions.length !== 1 ? 's' : ''} defined.
          </p>
        </div>
        <CreatePermissionForm />
      </div>

      <PermissionsClient permissions={permissions} rolesByPerm={rolesByPerm} />
    </main>
  );
}
