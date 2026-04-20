import BackButton from '@/components/back-button';
import { getTranslations } from 'next-intl/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requirePermission } from '@/lib/rbac/server';
import AthleteFilter from '../nutrition/athlete-filter';
import NewCaseForm from './new-case-form';
import NewMedicalSessionForm from './new-session-form';
import CaseStatusSelect from './case-status-select';
import SessionChart from './session-chart';
import SessionsList from './sessions-list';
import AttachmentsLoader from '@/components/attachments/attachments-loader';
import LinkedPlansSection, { type LinkedPlan } from '@/components/follow-up/linked-plans-section';
import SortableItems from '@/components/follow-up/sortable-items';

export const dynamic = 'force-dynamic';

type MedicalSession = {
  id: string;
  session_date: string;
  created_at: string;
  treatment_summary: string | null;
  pain_score: number | null;
  health_score: number | null;
  weight_kg: number | null;
  blood_pressure: string | null;
  adherence_score: number | null;
  notes: string | null;
  next_session_date: string | null;
};

type MedicalCase = {
  id: string;
  athlete_id: string | null;
  status: string;
  opened_at: string;
  condition: string | null;
  notes: string | null;
  athletes: { first_name: string; last_name: string } | null;
  profiles: { first_name: string; last_name: string } | null;
  medical_sessions: MedicalSession[];
};

const statusColors: Record<string, string> = {
  open:        'bg-blue-100 text-blue-700',
  in_progress: 'bg-yellow-100 text-yellow-700',
  closed:      'bg-gray-100 text-gray-600',
};

export default async function MedicalPage({
  searchParams,
}: {
  searchParams: Promise<{ athlete?: string }>;
}) {
  await requirePermission('view_athletes');

  const { athlete: selectedAthleteId = '' } = await searchParams;

  let casesQuery = supabaseAdmin
    .from('medical_cases')
    .select(
      'id, athlete_id, status, opened_at, condition, notes, ' +
      'athletes(first_name, last_name), profiles(first_name, last_name), ' +
      'medical_sessions(id, session_date, created_at, treatment_summary, pain_score, health_score, weight_kg, blood_pressure, adherence_score, notes, next_session_date)'
    )
    .order('opened_at', { ascending: false });

  if (selectedAthleteId) casesQuery = casesQuery.eq('athlete_id', selectedAthleteId);

  // Plans from the Plans module that match this discipline
  let plansQuery = supabaseAdmin
    .from('plans')
    .select('id, title, created_at, is_published, athlete_plans(athlete_id, athletes(first_name, last_name))')
    .eq('type', 'medical')
    .order('created_at', { ascending: false });
  if (selectedAthleteId) {
    plansQuery = plansQuery.eq('athlete_plans.athlete_id', selectedAthleteId);
  }

  // Look up the medic role to query the RBAC user_roles table
  const { data: medicRole } = await supabaseAdmin
    .from('roles')
    .select('id')
    .eq('code', 'medic')
    .maybeSingle();

  const [{ data: casesData, error }, { data: athletesData }, medicProfilesResult, { data: plansData }] =
    await Promise.all([
      casesQuery,
      supabaseAdmin.from('athletes').select('id, first_name, last_name').order('last_name'),
      // Fetch profiles assigned the medic role via the RBAC user_roles table
      medicRole
        ? supabaseAdmin
            .from('user_roles')
            .select('profile_id, profiles(id, first_name, last_name)')
            .eq('role_id', medicRole.id)
        : Promise.resolve({ data: [] }),
      plansQuery,
    ]);

  const cases = (casesData ?? []) as unknown as MedicalCase[];

  const athletes = (athletesData ?? []) as { id: string; first_name: string; last_name: string }[];

  // Extract the profile rows from the user_roles join
  type Person = { id: string; first_name: string; last_name: string };
  const doctors: Person[] = ((medicProfilesResult.data ?? []) as Array<{
    profile_id: string;
    profiles: Person | Person[] | null;
  }>)
    .map((ur) => (Array.isArray(ur.profiles) ? ur.profiles[0] : ur.profiles))
    .filter((p): p is Person => p != null)
    .sort((a, b) => a.last_name.localeCompare(b.last_name));

  const caseOptions = cases
    .filter((c) => c.status !== 'closed')
    .map((c) => ({
      id: c.id,
      label: c.athletes
        ? `${c.athletes.first_name} ${c.athletes.last_name}${c.condition ? ` — ${c.condition}` : ''} (${new Date(c.opened_at).toLocaleDateString()})`
        : `Case — ${new Date(c.opened_at).toLocaleDateString()}`,
    }));

  const linkedPlans = ((plansData ?? []) as unknown as LinkedPlan[])
    .filter((p) => !selectedAthleteId || p.athlete_plans.length > 0);

  const t = await getTranslations('followUp.medical');
  const tc = await getTranslations('common');

  return (
    <main className="p-8">
      <BackButton href="/follow-up" label={tc('backToFollowUp')} />

      <h1 className="text-3xl font-bold mt-4 mb-2 text-amber-700">{t('title')}</h1>
      <p className="text-gray-600 mb-8">{t('description')}</p>

      <AthleteFilter athletes={athletes} selectedId={selectedAthleteId} />

      <LinkedPlansSection plans={linkedPlans} followUpPath="/follow-up/medical" />

      <div className="flex flex-wrap items-start gap-3 mb-8">
        <NewCaseForm athletes={athletes} doctors={doctors} />
        {cases.length > 0 && <NewMedicalSessionForm cases={caseOptions} />}
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
          athleteName: c.athletes
            ? `${c.athletes.last_name} ${c.athletes.first_name}`
            : '',
          status: c.status,
          node: (
            <div className="rounded-lg border border-gray-200 p-5">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                <div>
                  <h2 className="text-lg font-semibold">
                    {c.athletes ? `${c.athletes.first_name} ${c.athletes.last_name}` : 'Unknown athlete'}
                  </h2>
                  <p className="text-sm text-gray-600 mt-1">
                    {c.profiles ? `Dr. ${c.profiles.first_name} ${c.profiles.last_name}` : t('noAssigned')}
                    {c.condition ? ` · ${c.condition}` : ''}
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
              {c.notes && (
                <p className="mt-3 text-sm text-gray-600 italic border-l-2 border-gray-200 pl-3">{c.notes}</p>
              )}
              <SessionChart sessions={c.medical_sessions} />
              <div className="mt-4 border-t border-gray-100 pt-3">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                  {tc('sessionHistory')} ({c.medical_sessions.length})
                </p>
                {c.medical_sessions.length === 0
                  ? <p className="text-sm text-gray-400">{tc('noSessionsYet')}</p>
                  : <SessionsList sessions={c.medical_sessions} />}
              </div>
              {c.athlete_id && (
                <div className="mt-4">
                  <AttachmentsLoader athleteId={c.athlete_id} module="medical" relatedRecordId={c.id} title="Documentos del caso" defaultCollapsed />
                </div>
              )}
            </div>
          ),
        }))}
      />
    </main>
  );
}
