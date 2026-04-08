import BackButton from '@/components/back-button';
import { requireAdminAccess, getAllRoles } from '@/lib/rbac/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import UsersClient from './users-client';
import type { ProfileWithRoles } from '@/lib/rbac/types';

export const dynamic = 'force-dynamic';

export default async function UsersRolesPage() {
  const currentUser = await requireAdminAccess();

  const [allRoles, profilesResult, userRolesResult] = await Promise.all([
    getAllRoles(),
    supabaseAdmin
      .from('profiles')
      .select('id, first_name, last_name, email, role, auth_user_id')
      .order('last_name'),
    supabaseAdmin
      .from('user_roles')
      .select('profile_id, role_id'),
  ]);

  const profiles = profilesResult.data ?? [];
  const userRoleRows = userRolesResult.data ?? [];

  // Build a map: profileId → Set<role_id> where role_id is an INTEGER
  const rolesByProfile: Record<string, Set<number>> = {};
  for (const ur of userRoleRows) {
    if (!rolesByProfile[ur.profile_id]) rolesByProfile[ur.profile_id] = new Set();
    rolesByProfile[ur.profile_id].add(Number(ur.role_id));
  }

  // Enrich profiles with their role objects
  const profilesWithRoles: ProfileWithRoles[] = profiles.map((p) => ({
    ...p,
    roles: allRoles.filter((r) => rolesByProfile[p.id]?.has(Number(r.id))),
  }));

  return (
    <main className="p-8 max-w-5xl">
      <BackButton href="/admin/access-control" label="Back to Access Control" />

      <div className="mt-4 mb-8">
        <h1 className="text-3xl font-bold">Users &amp; Roles</h1>
        <p className="text-gray-500 mt-1 text-sm">
          Assign or revoke roles for individual user profiles.
        </p>
      </div>

      <UsersClient
        profiles={profilesWithRoles}
        allRoles={allRoles}
        canDelete={currentUser.roles.some((r) => r.code === 'super_admin')}
        currentProfileId={currentUser.profile?.id ?? null}
      />
    </main>
  );
}
