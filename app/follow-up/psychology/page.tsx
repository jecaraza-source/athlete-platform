import Link from 'next/link';
import BackButton from '@/components/back-button';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requirePermission } from '@/lib/rbac/server';
import NewCaseForm from './new-case-form';
import NewSessionForm from './new-session-form';
import EditSessionForm from './edit-session-form';
import CaseStatusSelect from './case-status-select';

export const dynamic = 'force-dynamic';

type PsychologyCase = {
  id: string;
  status: string;
  opened_at: string;
  summary: string | null;
  athletes: { first_name: string; last_name: string } | null;
  profiles: { first_name: string; last_name: string } | null;
  psychology_sessions: {
    id: string;
    session_date: string;
    mood_score: number | null;
    stress_score: number | null;
    topic_summary: string | null;
    recommendations: string | null;
    next_session_date: string | null;
  }[];
};

const statusColors: Record<string, string> = {
  open: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-yellow-100 text-yellow-700',
  closed: 'bg-gray-100 text-gray-600',
};

export default async function PsychologyPage() {
  await requirePermission('view_athletes');

  const [{ data: casesData, error }, { data: athletesData }, { data: profilesData }] =
    await Promise.all([
      supabaseAdmin
        .from('psychology_cases')
        .select('id, status, opened_at, summary, athletes(first_name, last_name), profiles(first_name, last_name), psychology_sessions(id, session_date, mood_score, stress_score, topic_summary, recommendations, next_session_date)')
        .order('opened_at', { ascending: false }),
      supabaseAdmin.from('athletes').select('id, first_name, last_name').order('last_name'),
      supabaseAdmin.from('profiles').select('id, first_name, last_name').eq('role', 'psychologist').order('last_name'),
    ]);

  const cases = (casesData ?? []) as unknown as PsychologyCase[];
  const athletes = (athletesData ?? []) as { id: string; first_name: string; last_name: string }[];
  const psychologists = (profilesData ?? []) as { id: string; first_name: string; last_name: string }[];

  const caseOptions = cases.map((c) => ({
    id: c.id,
    label: c.athletes
      ? `${c.athletes.first_name} ${c.athletes.last_name} — ${new Date(c.opened_at).toLocaleDateString()}`
      : `Case — ${new Date(c.opened_at).toLocaleDateString()}`,
  }));

  return (
    <main className="p-8">
      <BackButton href="/follow-up" label="Back to Follow-up" />

      <h1 className="text-3xl font-bold mt-4 mb-2 text-amber-700">Psychology</h1>
      <p className="text-gray-600 mb-8">Record mental performance and wellbeing check-ins.</p>

      <div className="flex flex-wrap items-start gap-3 mb-8">
        <NewCaseForm athletes={athletes} psychologists={psychologists} />
        {cases.length > 0 && <NewSessionForm cases={caseOptions} />}
      </div>

      {error && (
        <div className="mb-4 rounded border border-red-300 bg-red-50 p-4 text-red-700">
          Error loading psychology cases: {error.message}
        </div>
      )}

      {!error && cases.length === 0 && (
        <div className="rounded border border-gray-200 p-4 text-gray-600">
          No psychology cases found yet.
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
                  Psychologist: {c.profiles ? `${c.profiles.first_name} ${c.profiles.last_name}` : 'N/A'}
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

            {c.summary && (
              <div className="mt-3 text-sm text-gray-700">
                <span className="font-medium">Notes:</span>{' '}{c.summary}
              </div>
            )}

            <div className="mt-4 border-t border-gray-100 pt-3">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                Session History ({c.psychology_sessions.length})
              </p>
              {c.psychology_sessions.length === 0 ? (
                <p className="text-sm text-gray-400">No sessions recorded yet.</p>
              ) : (
                <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                  {c.psychology_sessions
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
