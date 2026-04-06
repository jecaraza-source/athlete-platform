import Link from 'next/link';
import BackButton from '@/components/back-button';
import { supabaseAdmin } from '@/lib/supabase-admin';
import NewCaseForm from './new-case-form';
import NewPhysioSessionForm from './new-session-form';
import AthleteFilter from '../nutrition/athlete-filter';
import EditSessionForm from './edit-session-form';
import CaseStatusSelect from './case-status-select';

export const dynamic = 'force-dynamic';

type PhysioCase = {
  id: string;
  athlete_id: string | null;
  status: string;
  opened_at: string;
  athletes: { first_name: string; last_name: string } | null;
  profiles: { first_name: string; last_name: string } | null;
  injuries: { injury_type: string } | null;
  physio_sessions: {
    id: string;
    session_date: string;
    treatment_summary: string | null;
    pain_score: number | null;
    mobility_score: number | null;
    notes: string | null;
    next_session_date: string | null;
  }[];
};

const statusColors: Record<string, string> = {
  open: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-yellow-100 text-yellow-700',
  closed: 'bg-gray-100 text-gray-600',
};

export default async function PhysioPage({
  searchParams,
}: {
  searchParams: Promise<{ athlete?: string }>;
}) {
  const { athlete: selectedAthleteId = '' } = await searchParams;

  let casesQuery = supabaseAdmin
    .from('physio_cases')
    .select('id, athlete_id, status, opened_at, athletes(first_name, last_name), profiles(first_name, last_name), injuries(injury_type), physio_sessions(id, session_date, treatment_summary, pain_score, mobility_score, notes, next_session_date)')
    .order('opened_at', { ascending: false });

  if (selectedAthleteId) casesQuery = casesQuery.eq('athlete_id', selectedAthleteId);

  const [{ data: casesData, error }, { data: athletesData }, { data: profilesData }, { data: injuriesData }] =
    await Promise.all([
      casesQuery,
      supabaseAdmin.from('athletes').select('id, first_name, last_name').order('last_name'),
      supabaseAdmin.from('profiles').select('id, first_name, last_name').eq('role', 'physio').order('last_name'),
      supabaseAdmin.from('injuries').select('id, injury_type, athlete_id'),
    ]);

  const rawCases = (casesData ?? []) as unknown as PhysioCase[];
  // Keep non-closed cases first, closed cases at the bottom
  const cases = [
    ...rawCases.filter((c) => c.status !== 'closed'),
    ...rawCases.filter((c) => c.status === 'closed'),
  ];
  const athletes = (athletesData ?? []) as { id: string; first_name: string; last_name: string }[];
  const physios = (profilesData ?? []) as { id: string; first_name: string; last_name: string }[];
  const injuries = (injuriesData ?? []) as { id: string; injury_type: string; athlete_id: string }[];

  const caseOptions = cases.filter((c) => c.status !== 'closed').map((c) => ({
    id: c.id,
    label: c.athletes
      ? `${c.athletes.first_name} ${c.athletes.last_name} — ${new Date(c.opened_at).toLocaleDateString()}`
      : `Case — ${new Date(c.opened_at).toLocaleDateString()}`,
  }));

  return (
    <main className="p-8">
      <BackButton href="/follow-up" label="Back to Follow-up" />

      <h1 className="text-3xl font-bold mt-4 mb-2">Physio</h1>
      <p className="text-gray-600 mb-8">Log injuries, recovery progress, and treatments.</p>

      <AthleteFilter athletes={athletes} selectedId={selectedAthleteId} />

      <div className="flex flex-wrap items-start gap-3 mb-8">
        <NewCaseForm athletes={athletes} physios={physios} injuries={injuries} />
        {cases.length > 0 && <NewPhysioSessionForm cases={caseOptions} />}
      </div>

      {error && (
        <div className="mb-4 rounded border border-red-300 bg-red-50 p-4 text-red-700">
          Error loading physio cases: {error.message}
        </div>
      )}

      {!error && cases.length === 0 && (
        <div className="rounded border border-gray-200 p-4 text-gray-600">
          No physio cases found yet.
        </div>
      )}

      <div className="space-y-4">
        {cases.map((c) => (
          <div key={c.id} className="rounded-lg border border-gray-200 p-5">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold">
                  {c.athletes
                    ? `${c.athletes.first_name} ${c.athletes.last_name}`
                    : 'Unknown athlete'}
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  Physio: {c.profiles ? `${c.profiles.first_name} ${c.profiles.last_name}` : 'N/A'}
                  {c.injuries ? ` · ${c.injuries.injury_type}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full capitalize ${statusColors[c.status] ?? 'bg-gray-100 text-gray-600'}`}>
                  {c.status}
                </span>
                <span className="text-sm text-gray-500">
                  {new Date(c.opened_at).toLocaleDateString()}
                </span>
                <CaseStatusSelect caseId={c.id} currentStatus={c.status} />
              </div>
            </div>

            <div className="mt-4 border-t border-gray-100 pt-3">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                Session History ({c.physio_sessions.length})
              </p>
              {c.physio_sessions.length === 0 ? (
                <p className="text-sm text-gray-400">No sessions recorded yet.</p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {c.physio_sessions
                    .slice()
                    .sort((a, b) => new Date(b.session_date).getTime() - new Date(a.session_date).getTime())
                    .map((s) => (
                      <EditSessionForm key={s.id} session={s} />
                    ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

    </main>
  );
}
