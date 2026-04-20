import BackButton from '@/components/back-button';
import { getTranslations } from 'next-intl/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requirePermission, getProfilesByRoleCodes } from '@/lib/rbac/server';
import NewPlanForm from './new-plan-form';
import AthleteFilter from './athlete-filter';
import CheckinForm from './checkin-form';
import CheckinChart from './checkin-chart';
import PlanStatusSelect from './plan-status-select';
import AttachmentsLoader from '@/components/attachments/attachments-loader';
import LinkedPlansSection, { type LinkedPlan } from '@/components/follow-up/linked-plans-section';
import SortableItems from '@/components/follow-up/sortable-items';

export const dynamic = 'force-dynamic';

type NutritionCheckin = {
  id: string;
  athlete_id: string;
  checkin_date: string;
  weight_kg: number | null;
  body_fat_percent: number | null;
  adherence_score: number | null;
  notes: string | null;
  next_actions: string | null;
};

type NutritionPlan = {
  id: string;
  athlete_id: string | null;
  title: string;
  start_date: string;
  end_date: string | null;
  status: string;
  athletes: { first_name: string; last_name: string } | null;
  profiles: { first_name: string; last_name: string } | null;
};

const statusColors: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  completed: 'bg-gray-100 text-gray-600',
  paused: 'bg-yellow-100 text-yellow-700',
};

export default async function NutritionPage({
  searchParams,
}: {
  searchParams: Promise<{ athlete?: string }>;
}) {
  await requirePermission('view_athletes');

  const { athlete: selectedAthleteId = '' } = await searchParams;

  function buildPlansQuery() {
    const cols = 'id, athlete_id, title, start_date, end_date, status, athletes(first_name, last_name), profiles(first_name, last_name)';
    let q = supabaseAdmin.from('nutrition_plans').select(cols);
    if (selectedAthleteId) q = q.eq('athlete_id', selectedAthleteId);
    return q.order('start_date', { ascending: false });
  }

  const checkinsQuery = supabaseAdmin
    .from('nutrition_checkins')
    .select('id, athlete_id, checkin_date, weight_kg, body_fat_percent, adherence_score, notes, next_actions')
    .order('checkin_date', { ascending: false });

  let globalPlansQuery = supabaseAdmin
    .from('plans')
    .select('id, title, created_at, is_published, athlete_plans(athlete_id, athletes(first_name, last_name))')
    .eq('type', 'nutrition')
    .order('created_at', { ascending: false });
  if (selectedAthleteId) {
    globalPlansQuery = globalPlansQuery.eq('athlete_plans.athlete_id', selectedAthleteId);
  }

  const [{ data, error }, { data: athletesData }, nutritionistsData, { data: checkinsData }, { data: globalPlansData }] = await Promise.all([
    buildPlansQuery(),
    supabaseAdmin.from('athletes').select('id, first_name, last_name').order('last_name', { ascending: true }),
    // RBAC-aware: new system uses 'staff' for all specialists.
    // Falls back to legacy profiles.role = 'nutritionist'.
    getProfilesByRoleCodes(['staff'], ['nutritionist']),
    checkinsQuery,
    globalPlansQuery,
  ]);

  const plans = (data ?? []) as unknown as NutritionPlan[];
  const athletes = (athletesData ?? []) as { id: string; first_name: string; last_name: string }[];
  const nutritionists = nutritionistsData;
  const checkins = (checkinsData ?? []) as NutritionCheckin[];
  const linkedPlans = ((globalPlansData ?? []) as unknown as LinkedPlan[])
    .filter((p) => !selectedAthleteId || p.athlete_plans.length > 0);

  // Group all checkins by athlete (already sorted desc by checkin_date)
  const checkinsByAthlete = checkins.reduce<Record<string, NutritionCheckin[]>>((acc, c) => {
    if (!acc[c.athlete_id]) acc[c.athlete_id] = [];
    acc[c.athlete_id].push(c);
    return acc;
  }, {});

  const t = await getTranslations('followUp.nutrition');
  const tc = await getTranslations('common');

  const statusLabels: Record<string, string> = {
    active: t('statusActive'),
    completed: t('statusCompleted'),
    paused: t('statusPaused'),
  };

  return (
    <main className="p-8">
      <BackButton href="/follow-up" label={tc('backToFollowUp')} />

      <h1 className="text-3xl font-bold mt-4 mb-2 text-amber-700">{t('title')}</h1>
      <p className="text-gray-600 mb-8">{t('description')}</p>

      <AthleteFilter athletes={athletes} selectedId={selectedAthleteId} />

      <LinkedPlansSection plans={linkedPlans} followUpPath="/follow-up/nutrition" />

      <CheckinChart
        checkins={selectedAthleteId ? (checkinsByAthlete[selectedAthleteId] ?? []) : checkins}
      />

      <NewPlanForm athletes={athletes} nutritionists={nutritionists} />

      {error && (
        <div className="mb-4 rounded border border-red-300 bg-red-50 p-4 text-red-700">
          {t('errorLoading')} {error.message}
        </div>
      )}

      <SortableItems
        emptyNode={
          !error && plans.length === 0 ? (
            <div className="rounded border border-gray-200 p-4 text-gray-600">{t('noPlans')}</div>
          ) : null
        }
        items={plans.map((plan) => ({
          id: plan.id,
          date: plan.start_date,
          athleteName: plan.athletes ? `${plan.athletes.last_name} ${plan.athletes.first_name}` : '',
          status: plan.status,
          node: (
            <div className="rounded-lg border border-gray-200 p-5">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                <div>
                  <h2 className="text-lg font-semibold">{plan.title}</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    {plan.athletes ? `${plan.athletes.first_name} ${plan.athletes.last_name}` : tc('unknownAthlete')}
                  </p>
                </div>
                <div className="flex items-center gap-2 self-start md:self-auto">
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusColors[plan.status] ?? 'bg-gray-100 text-gray-600'}`}>
                    {statusLabels[plan.status] ?? plan.status}
                  </span>
                  <PlanStatusSelect planId={plan.id} currentStatus={plan.status} />
                </div>
              </div>
              <div className="mt-3 text-sm text-gray-700 space-y-1">
                <p>
                  <span className="font-medium">{t('nutritionist')}:</span>{' '}
                  {plan.profiles ? `${plan.profiles.first_name} ${plan.profiles.last_name}` : tc('na')}
                </p>
                <p>
                  <span className="font-medium">{t('period')}:</span>{' '}
                  {new Date(plan.start_date).toLocaleDateString()}
                  {plan.end_date ? ` – ${new Date(plan.end_date).toLocaleDateString()}` : ` ${t('ongoing')}`}
                </p>
              </div>
              {plan.athlete_id && (
                <CheckinForm
                  athleteId={plan.athlete_id}
                  nutritionists={nutritionists}
                  previousCheckins={checkinsByAthlete[plan.athlete_id] ?? []}
                />
              )}
              {plan.athlete_id && (
                <div className="mt-4">
                  <AttachmentsLoader athleteId={plan.athlete_id} module="nutrition" relatedRecordId={plan.id} title="Documentos del plan" defaultCollapsed />
                </div>
              )}
            </div>
          ),
        }))}
      />
    </main>
  );
}
