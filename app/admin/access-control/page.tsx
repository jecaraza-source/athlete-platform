import Link from 'next/link';
import BackButton from '@/components/back-button';
import { requireAdminAccess, getAllRoles, getAllPermissions } from '@/lib/rbac/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export default async function AccessControlPage() {
  await requireAdminAccess();

  const [roles, permissions] = await Promise.all([
    getAllRoles(),
    getAllPermissions(),
  ]);

  const { count: userCount } = await supabaseAdmin
    .from('profiles')
    .select('id', { count: 'exact', head: true });

  const stats = [
    { label: 'Roles', value: roles.length, href: '/admin/access-control/roles', color: 'violet' },
    { label: 'Permissions', value: permissions.length, href: '/admin/access-control/permissions', color: 'sky' },
    { label: 'Users', value: userCount ?? 0, href: '/admin/access-control/users', color: 'emerald' },
  ] as const;

  const colorMap = {
    violet: {
      card: 'border-violet-200 bg-violet-50 hover:bg-violet-100',
      value: 'text-violet-700',
      label: 'text-violet-600',
    },
    sky: {
      card: 'border-sky-200 bg-sky-50 hover:bg-sky-100',
      value: 'text-sky-700',
      label: 'text-sky-600',
    },
    emerald: {
      card: 'border-emerald-200 bg-emerald-50 hover:bg-emerald-100',
      value: 'text-emerald-700',
      label: 'text-emerald-600',
    },
  };

  return (
    <main className="p-8">
      <BackButton href="/admin" label="Back to Admin" />

      <h1 className="text-3xl font-bold mt-4 mb-1 text-rose-700">Access Control</h1>
      <p className="text-gray-600 mb-8">
        Manage roles, permissions, and user access across the platform.
      </p>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-12">
        {stats.map((stat) => {
          const c = colorMap[stat.color];
          return (
            <Link
              key={stat.href}
              href={stat.href}
              className={`rounded-xl border p-6 transition-colors ${c.card}`}
            >
              <p className={`text-4xl font-bold ${c.value}`}>{stat.value}</p>
              <p className={`mt-1 text-sm font-medium ${c.label}`}>{stat.label}</p>
            </Link>
          );
        })}
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link
          href="/admin/access-control/roles"
          className="rounded-xl border border-gray-200 p-6 hover:bg-gray-50 transition-colors"
        >
          <h2 className="font-semibold text-gray-900">Roles</h2>
          <p className="text-sm text-gray-500 mt-1">
            Create and manage roles. Assign permissions to each role.
          </p>
        </Link>
        <Link
          href="/admin/access-control/permissions"
          className="rounded-xl border border-gray-200 p-6 hover:bg-gray-50 transition-colors"
        >
          <h2 className="font-semibold text-gray-900">Permissions</h2>
          <p className="text-sm text-gray-500 mt-1">
            View and manage individual permission definitions.
          </p>
        </Link>
        <Link
          href="/admin/access-control/users"
          className="rounded-xl border border-gray-200 p-6 hover:bg-gray-50 transition-colors"
        >
          <h2 className="font-semibold text-gray-900">Users &amp; Roles</h2>
          <p className="text-sm text-gray-500 mt-1">
            Assign or revoke roles for individual users.
          </p>
        </Link>
      </div>
    </main>
  );
}
