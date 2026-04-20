import BackButton from '@/components/back-button';
import { getTranslations } from 'next-intl/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requirePermission, getProfilesByRoleCodes } from '@/lib/rbac/server';
import NewCaseForm from './new-case-form';
import NewPhysioSessionForm from './new-session-form';
import AthleteFilter from '../nutrition/athlete-filter';
import EditSessionForm from './edit-session-form';
import CaseStatusSelect from './case-status-select';
import AttachmentsLoader from '@/components/attachments/attachments-loader';
import LinkedPlansSection, { type LinkedPlan } from '@/components/follow-up/linked-plans-section';
import SortableItems from '@/components/follow-up/sortable-items';

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
  await requirePermission('view_athletes');

  const { athlete: selectedAthleteId = '' } = await searchParams;

  let casesQuery = supabaseAdmin
    .from('physio_cases')
    .select('id, athlete_id, status, opened_at, athletes(first_name, last_name), profiles(first_name, last_name), injuries(injury_type), physio_sessions(id, session_date, treatment_summary, pain_score, mobility_score, notes, next_session_date)')
    .order('opened_at', { ascending: false });

  if (selectedAthleteId) casesQuery = casesQuery.eq('athlete_id', selectedAthleteId);

  let plansQuery = supabaseAdmin
    .from('plans')
    .select('id, title, created_at, is_published, athlete_plans(athlete_id, athletes(first_name, last_name))')
    .eq('type', 'rehabilitation')
    .order('created_at', { ascending: false });
  if (selectedAthleteId) {
    plansQuery = plansQuery.eq('athlete_plans.athlete_id', selectedAthleteId);
  }

  const [{ data: casesData, error }, { data: athletesData }, physiosData, { data: injuriesData }, { data: plansData }] =
    await Promise.all([
      casesQuery,
      supabaseAdmin.from('athletes').select('id, first_name, last_name').order('last_name'),
      // RBAC-aware: new system uses 'staff' for all specialists.
      // Falls back to legacy profiles.role = 'physio'.
      getProfilesByRoleCodes(['staff'], ['physio']),
      supabaseAdmin.from('injuries').select('id, injury_type, athlete_id'),
      plansQuery,
    ]);

  const cases = (casesData ?? []) as unknown as PhysioCase[];
  const athletes = (athletesData ?? []) as { id: string; first_name: string; last_name: string }[];
  const physios = physiosData;
  const injuries = (injuriesData ?? []) as { id: string; injury_type: string; athlete_id: string }[];
  const linkedPlans = ((plansData ?? []) as unknown as LinkedPlan[])
    .filter((p) => !selectedAthleteId || p.athlete_plans.length > 0);

  const caseOptions = cases.filter((c) => c.status !== 'closed').map((c) => ({
    id: c.id,
    label: c.athletes
      ? `${c.athletes.first_name} ${c.athletes.last_name} — ${new Date(c.opened_at).toLocaleDateString()}`
      : `Case — ${new Date(c.opened_at).toLocaleDateString()}`,
  }));

  const t = await getTranslations('followUp.physio');
  const tc = await getTranslations('common');

  return (
    <main className="p-8">
      <BackButton href="/follow-up" label={tc('backToFollowUp')} />

      <h1 className="text-3xl font-bold mt-4 mb-2 text-amber-700">{t('title')}</h1>
      <p className="text-gray-600 mb-8">{t('description')}</p>

      <AthleteFilter athletes={athletes} selectedId={selectedAthleteId} />

      <LinkedPlansSection plans={linkedPlans} followUpPath="/follow-up/physio" />

      <div className="flex flex-wrap items-start gap-3 mb-8">
        <NewCaseForm athletes={athletes} physios={physios} injuries={injuries} />
        {cases.length > 0 && <NewPhysioSessionForm cases={caseOptions} />}
      </div>

      {error && (
        <div className="mb-4 rounded border border-red-300 bg-red-50 p-4 text-red-700">
          {t('errorLoading')} {error.message}
        </div>
      )}

      <SortableItems
        emptyNode={
          !error && cases.length === 0 ? (
            <div className="rounded border border-gray-200 p-4 text-gray-600">{t('noCases')}</div>
          ) : null
        }
        items={cases.map((c) => ({
          id: c.id,
          date: c.opened_at,
          athleteName: c.athletes ? `${c.athletes.last_name} ${c.athletes.first_name}` : '',
          status: c.status,
          node: (
            <div className="rounded-lg border border-gray-200 p-5">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                <div>
                  <h2 className="text-lg font-semibold">
                    {c.athletes ? `${c.athletes.first_name} ${c.athletes.last_name}` : 'Unknown athlete'}
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
                  <span className="text-sm text-gray-500">{new Date(c.opened_at).toLocaleDateString()}</span>
                  <CaseStatusSelect caseId={c.id} currentStatus={c.status} />
                </div>
              </div>
              <div className="mt-4 border-t border-gray-100 pt-3">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                  {tc('sessionHistory')} ({c.physio_sessions.length})
                </p>
                {c.physio_sessions.length === 0 ? (
                  <p className="text-sm text-gray-400">{tc('noSessionsYet')}</p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {c.physio_sessions
                      .slice()
                      .sort((a, b) => new Date(b.session_date).getTime() - new Date(a.session_date).getTime())
                      .map((s) => <EditSessionForm key={s.id} session={s} />)}
                  </div>
                )}
              </div>
              {c.athlete_id && (
                <div className="mt-4">
                  <AttachmentsLoader athleteId={c.athlete_id} module="physio" relatedRecordId={c.id} title="Documentos del caso" defaultCollapsed />
                </div>
              )}
            </div>
          ),
        }))}
      />

    </main>
  );
}
