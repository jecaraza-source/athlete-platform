import BackButton from '@/components/back-button';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requirePermission, getProfilesByRoleCodes } from '@/lib/rbac/server';
import { getTranslations } from 'next-intl/server';
import NewSessionForm from './new-session-form';
import AthleteFilter from '../nutrition/athlete-filter';
import AttachmentsLoader from '@/components/attachments/attachments-loader';
import LinkedPlansSection, { type LinkedPlan } from '@/components/follow-up/linked-plans-section';
import TrainingSessionsList from './sessions-list';

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
  await requirePermission('view_athletes');

  const { athlete: selectedAthleteId = '' } = await searchParams;

  let sessionsQuery = supabaseAdmin
    .from('training_sessions')
    .select('id, athlete_id, session_date, title, location, start_time, end_time, notes, athletes(first_name, last_name)')
    .order('session_date', { ascending: false });

  if (selectedAthleteId) sessionsQuery = sessionsQuery.eq('athlete_id', selectedAthleteId);

  let plansQuery = supabaseAdmin
    .from('plans')
    .select('id, title, created_at, is_published, athlete_plans(athlete_id, athletes(first_name, last_name))')
    .eq('type', 'training')
    .order('created_at', { ascending: false });
  if (selectedAthleteId) {
    plansQuery = plansQuery.eq('athlete_plans.athlete_id', selectedAthleteId);
  }

  const [{ data, error }, { data: athletesData }, coachesData, { data: plansData }] = await Promise.all([
    sessionsQuery,
    supabaseAdmin
      .from('athletes')
      .select('id, first_name, last_name')
      .order('last_name', { ascending: true }),
    // RBAC-aware: queries user_roles → roles(code='coach').
    // Falls back to profiles.role = 'coach' if no RBAC assignments found.
    getProfilesByRoleCodes(['coach']),
    plansQuery,
  ]);

  const sessions = (data ?? []) as unknown as TrainingSession[];
  const athletes = (athletesData ?? []) as { id: string; first_name: string; last_name: string }[];
  const coaches = coachesData;
  const linkedPlans = ((plansData ?? []) as unknown as LinkedPlan[])
    .filter((p) => !selectedAthleteId || p.athlete_plans.length > 0);

  const t = await getTranslations('followUp.training');
  const tc = await getTranslations('common');

  return (
    <main className="p-8">
      <BackButton href="/follow-up" label={tc('backToFollowUp')} />

      <h1 className="text-3xl font-bold mt-4 mb-2 text-amber-700">{t('title')}</h1>
      <p className="text-gray-600 mb-8">{t('description')}</p>

      <AthleteFilter athletes={athletes} selectedId={selectedAthleteId} />

      <LinkedPlansSection
        plans={linkedPlans}
        followUpPath="/follow-up/training"
        showConfirm
      />

      <NewSessionForm
        athletes={athletes}
        coaches={coaches}
      />

      {error && (
        <div className="mb-4 rounded border border-red-300 bg-red-50 p-4 text-red-700">
          {t('errorLoading')} {error.message}
        </div>
      )}

      {!error && sessions.length === 0 && (
        <div className="rounded border border-gray-200 p-4 text-gray-600">
          {t('noSessions')}
        </div>
      )}

      <TrainingSessionsList
        slots={sessions.map((session) => ({
          session,
          attachmentNode: (
            <AttachmentsLoader
              athleteId={session.athlete_id}
              module="training"
              relatedRecordId={session.id}
              title="Documentos de la sesión"
              defaultCollapsed
            />
          ),
        }))}
        sessionDetailsLabel={t('sessionDetailsLabel')}
        unknownAthlete={tc('unknownAthlete')}
      />
    </main>
  );
}
