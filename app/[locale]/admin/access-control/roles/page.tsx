import BackButton from '@/components/back-button';
import { requireAdminAccess, getAllRoles } from '@/lib/rbac/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getTranslations } from 'next-intl/server';
import CreateRoleForm from './create-role-form';
import RoleRow from './role-row';

export const dynamic = 'force-dynamic';

export default async function RolesPage() {
  await requireAdminAccess();

  const roles = await getAllRoles();

  // Attach permission counts
  const { data: rpRows } = await supabaseAdmin
    .from('role_permissions')
    .select('role_id');

  const permCountByRole: Record<string, number> = {};
  for (const rp of rpRows ?? []) {
    permCountByRole[rp.role_id] = (permCountByRole[rp.role_id] ?? 0) + 1;
  }

  // Attach user counts
  const { data: urRows } = await supabaseAdmin
    .from('user_roles')
    .select('role_id');

  const userCountByRole: Record<string, number> = {};
  for (const ur of urRows ?? []) {
    userCountByRole[ur.role_id] = (userCountByRole[ur.role_id] ?? 0) + 1;
  }

  const t = await getTranslations('admin.accessControl');

  return (
    <main className="p-8">
      <BackButton href="/admin/access-control" label={t('backTo')} />

      <div className="flex items-start justify-between mt-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-rose-700">{t('roles.title')}</h1>
          <p className="text-gray-600 mt-1">
            {t('roles.count', { count: roles.length })}
          </p>
        </div>
        <CreateRoleForm />
      </div>

      <div className="rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-5 py-3 font-semibold text-gray-700">{t('roles.columnName')}</th>
              <th className="text-left px-5 py-3 font-semibold text-gray-700">{t('roles.columnDescription')}</th>
              <th className="text-center px-5 py-3 font-semibold text-gray-700">{t('roles.columnType')}</th>
              <th className="text-center px-5 py-3 font-semibold text-gray-700">{t('roles.columnPermissions')}</th>
              <th className="text-center px-5 py-3 font-semibold text-gray-700">{t('roles.columnUsers')}</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {roles.map((role) => (
              <RoleRow
                key={role.id}
                role={role}
                permissionCount={permCountByRole[role.id] ?? 0}
                userCount={userCountByRole[role.id] ?? 0}
              />
            ))}
            {roles.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-12 text-center">
                  <p className="text-gray-500 font-medium text-sm">{t('roles.noRoles')}</p>
                  <p className="text-gray-400 text-xs mt-1">{t('roles.noRolesHint')}</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
