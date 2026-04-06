import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase-admin';
import NewStaffForm from '../staff/new-staff-form';
import StaffCard from '../staff/staff-card';
import type { Profile } from '../staff/staff-card';

export const dynamic = 'force-dynamic';

export default async function AdminAthletesPage() {
  const fullResult = await supabaseAdmin
    .from('profiles')
    .select('id, first_name, last_name, role, email, phone, specialty')
    .eq('role', 'athlete')
    .order('last_name', { ascending: true });

  const hasExtendedColumns = !fullResult.error?.message?.includes('does not exist');

  const { data, error } = hasExtendedColumns
    ? fullResult
    : await supabaseAdmin
        .from('profiles')
        .select('id, first_name, last_name')
        .eq('role', 'athlete')
        .order('last_name', { ascending: true });

  const athletes = (data ?? []) as Profile[];

  return (
    <main className="p-8">
      <Link href="/admin" className="text-blue-600 hover:underline">
        ← Back to Admin
      </Link>

      <h1 className="text-3xl font-bold mt-4 mb-2">Athletes</h1>
      <p className="text-gray-600 mb-8">Register new athletes and manage their profiles.</p>

      {error && (
        <div className="mb-6 rounded border border-red-300 bg-red-50 p-4 text-red-700">
          Error loading athletes: {error.message}
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <p className="text-sm text-gray-500">{athletes.length} athlete{athletes.length !== 1 ? 's' : ''}</p>
        <NewStaffForm
          hasExtendedColumns={hasExtendedColumns}
          presetRole="athlete"
          buttonLabel="+ Add athlete"
        />
      </div>

      {athletes.length === 0 ? (
        <p className="text-sm text-gray-500">No athletes yet. Add the first one above.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {athletes.map((p) => (
            <StaffCard key={p.id} profile={p} hasExtendedColumns={hasExtendedColumns} />
          ))}
        </div>
      )}
    </main>
  );
}
