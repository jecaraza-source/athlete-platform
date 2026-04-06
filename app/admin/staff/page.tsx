import Link from 'next/link';
import BackButton from '@/components/back-button';
import { supabaseAdmin } from '@/lib/supabase-admin';
import NewStaffForm from './new-staff-form';
import StaffCard from './staff-card';
import type { Profile } from './staff-card';

export const dynamic = 'force-dynamic';

const ADMIN_ROLES = ['super_admin', 'admin'];
const STAFF_ROLES = ['psychologist', 'trainer', 'nutritionist', 'physio'];

const MIGRATION_SQL = `
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role      text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email     text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone     text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS specialty text;
`.trim();

export default async function StaffPage() {
  // Try with extended columns; fall back to just name fields if schema is not yet migrated
  const fullResult = await supabaseAdmin
    .from('profiles')
    .select('id, first_name, last_name, role, email, phone, specialty')
    .order('last_name', { ascending: true });

  const hasExtendedColumns = !fullResult.error?.message?.includes('does not exist');

  const { data, error } = hasExtendedColumns
    ? fullResult
    : await supabaseAdmin
        .from('profiles')
        .select('id, first_name, last_name')
        .order('last_name', { ascending: true });

  const profiles = (data ?? []) as Profile[];

  const admins = profiles.filter((p) => p.role && ADMIN_ROLES.includes(p.role));
  const staff = profiles.filter((p) => p.role && STAFF_ROLES.includes(p.role));
  const ungrouped = profiles.filter(
    (p) => !p.role || (!ADMIN_ROLES.includes(p.role) && p.role !== 'athlete' && !STAFF_ROLES.includes(p.role))
  );

  return (
    <main className="p-8">
      <BackButton href="/admin" label="Back to Admin" />

      <h1 className="text-3xl font-bold mt-4 mb-2">Admin Setup</h1>
      <p className="text-gray-600 mb-8">
        Manage administrators and staff members.
      </p>

      {error && (
        <div className="mb-6 rounded border border-red-300 bg-red-50 p-4 text-red-700">
          Error loading profiles: {error.message}
        </div>
      )}

      <div className="space-y-12">
        {/* Admins */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Administrators</h2>
            <NewStaffForm
              hasExtendedColumns={hasExtendedColumns}
              presetRole="admin"
              buttonLabel="+ New admin"
            />
          </div>
          {admins.length === 0 ? (
            <p className="text-sm text-gray-500">No admin profiles yet.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {admins.map((p) => (
                <StaffCard key={p.id} profile={p} hasExtendedColumns={hasExtendedColumns} />
              ))}
            </div>
          )}
        </section>

        {/* Staff */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Staff</h2>
            <NewStaffForm
              hasExtendedColumns={hasExtendedColumns}
              buttonLabel="+ Add staff member"
            />
          </div>
          {staff.length === 0 ? (
            <p className="text-sm text-gray-500">No staff members yet.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {staff.map((p) => (
                <StaffCard key={p.id} profile={p} hasExtendedColumns={hasExtendedColumns} />
              ))}
            </div>
          )}
        </section>

        {ungrouped.length > 0 && (
          <section>
            <h2 className="text-xl font-semibold mb-4">Other</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {ungrouped.map((p) => (
                <StaffCard key={p.id} profile={p} hasExtendedColumns={hasExtendedColumns} />
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

