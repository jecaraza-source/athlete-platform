import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

type Athlete = {
  id: string;
  first_name: string;
  last_name: string;
  status: string;
  school_or_club: string | null;
};

export default async function AthletesPage() {
  const { data, error } = await supabaseAdmin
    .from('athletes')
    .select('id, first_name, last_name, status, school_or_club')
    .order('last_name', { ascending: true });

  if (error) {
    return (
      <main className="p-8">
        <Link href="/dashboard" className="text-blue-600 hover:underline">
          ← Back to Dashboard
        </Link>
        <h1 className="text-2xl font-bold mt-4">Athletes</h1>
        <p className="text-red-600 mt-4">Failed to load athletes.</p>
      </main>
    );
  }

  const athletes = (data ?? []) as Athlete[];

  return (
    <main className="p-8">
      <Link href="/dashboard" className="text-blue-600 hover:underline">
        ← Back to Dashboard
      </Link>
      <h1 className="text-2xl font-bold mt-4 mb-6">Athletes</h1>

      {athletes.length === 0 ? (
        <p className="text-gray-500">No athletes found.</p>
      ) : (
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b text-left text-gray-500">
              <th className="pb-2 pr-4 font-medium">Name</th>
              <th className="pb-2 pr-4 font-medium">School / Club</th>
              <th className="pb-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {athletes.map((athlete) => (
              <tr key={athlete.id} className="border-b hover:bg-gray-50">
                <td className="py-3 pr-4">
                  <Link
                    href={`/athletes/${athlete.id}`}
                    className="text-blue-600 hover:underline font-medium"
                  >
                    {athlete.first_name} {athlete.last_name}
                  </Link>
                </td>
                <td className="py-3 pr-4 text-gray-600">{athlete.school_or_club ?? '—'}</td>
                <td className="py-3 text-gray-600 capitalize">{athlete.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
