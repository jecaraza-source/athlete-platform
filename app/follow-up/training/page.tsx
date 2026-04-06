import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { supabaseAdmin } from '@/lib/supabase-admin';
import NewSessionForm from './new-session-form';
import AthleteFilter from '../nutrition/athlete-filter';

export const dynamic = 'force-dynamic';

type TrainingSession = {
  id: string;
  athlete_id: string;
  session_date: string;
  title: string;
  location: string | null;
  start_time: string | null;
  end_time: string | null;
  notes: string | null;
  athletes: {
    first_name: string;
    last_name: string;
  } | null;
};

export default async function TrainingPage({
  searchParams,
}: {
  searchParams: Promise<{ athlete?: string }>;
}) {
  const { athlete: selectedAthleteId = '' } = await searchParams;

  let sessionsQuery = supabaseAdmin
    .from('training_sessions')
    .select('id, athlete_id, session_date, title, location, start_time, end_time, notes, athletes(first_name, last_name)')
    .order('session_date', { ascending: false });

  if (selectedAthleteId) sessionsQuery = sessionsQuery.eq('athlete_id', selectedAthleteId);

  const [{ data, error }, { data: athletesData }, { data: profilesData }] = await Promise.all([
    sessionsQuery,
    supabase
      .from('athletes')
      .select('id, first_name, last_name')
      .order('last_name', { ascending: true }),
    supabaseAdmin
      .from('profiles')
      .select('id, first_name, last_name')
      .eq('role', 'trainer')
      .order('last_name', { ascending: true }),
  ]);

  const sessions = (data ?? []) as unknown as TrainingSession[];
  const athletes = (athletesData ?? []) as { id: string; first_name: string; last_name: string }[];
  const coaches = (profilesData ?? []) as { id: string; first_name: string; last_name: string }[];

  return (
    <main className="p-8">
      <Link href="/follow-up" className="text-blue-600 hover:underline">
        ← Back to Follow-up
      </Link>

      <h1 className="text-3xl font-bold mt-4 mb-2">Training</h1>
      <p className="text-gray-600 mb-8">Track workload, intensity, and session notes.</p>

      <AthleteFilter athletes={athletes} selectedId={selectedAthleteId} />

      <NewSessionForm athletes={athletes} coaches={coaches} />

      {error && (
        <div className="mb-4 rounded border border-red-300 bg-red-50 p-4 text-red-700">
          Error loading training sessions: {error.message}
        </div>
      )}

      {!error && sessions.length === 0 && (
        <div className="rounded border border-gray-200 p-4 text-gray-600">
          No training sessions found yet.
        </div>
      )}

      <div className="space-y-4">
        {sessions.map((session) => (
          <div key={session.id} className="rounded-lg border border-gray-200 p-5">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold">{session.title}</h2>
                <p className="text-sm text-gray-600 mt-1">
                  {session.athletes
                    ? `${session.athletes.first_name} ${session.athletes.last_name}`
                    : 'Unknown athlete'}
                </p>
              </div>
              <div className="text-sm text-gray-600">
                {new Date(session.session_date).toLocaleDateString()}
              </div>
            </div>

            <div className="mt-3 text-sm text-gray-700 space-y-1">
              <p>
                <span className="font-medium">Time:</span>{' '}
                {session.start_time && session.end_time
                  ? `${session.start_time} – ${session.end_time}`
                  : session.start_time ?? 'N/A'}
              </p>
              <p>
                <span className="font-medium">Location:</span>{' '}
                {session.location ?? 'N/A'}
              </p>
              <p>
                <span className="font-medium">Notes:</span>{' '}
                {session.notes ?? 'N/A'}
              </p>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
