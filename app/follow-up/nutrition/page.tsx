import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { supabaseAdmin } from '@/lib/supabase-admin';
import NewPlanForm from './new-plan-form';
import UploadButton from './upload-button';
import { getNutritionFileUrl } from './upload-action';
import AthleteFilter from './athlete-filter';
import CheckinForm from './checkin-form';
import CheckinChart from './checkin-chart';
import PlanStatusSelect from './plan-status-select';

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
  file_path: string | null;
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
  const { athlete: selectedAthleteId = '' } = await searchParams;

  function buildPlansQuery(withFilePath: boolean) {
    const cols = withFilePath
      ? 'id, athlete_id, title, start_date, end_date, status, file_path, athletes(first_name, last_name), profiles(first_name, last_name)'
      : 'id, athlete_id, title, start_date, end_date, status, athletes(first_name, last_name), profiles(first_name, last_name)';
    let q = supabaseAdmin.from('nutrition_plans').select(cols);
    if (selectedAthleteId) q = q.eq('athlete_id', selectedAthleteId);
    return q.order('start_date', { ascending: false });
  }

  const checkinsQuery = supabaseAdmin
    .from('nutrition_checkins')
    .select('id, athlete_id, checkin_date, weight_kg, body_fat_percent, adherence_score, notes, next_actions')
    .order('checkin_date', { ascending: false });

  const [plansResult, { data: athletesData }, { data: profilesData }, { data: checkinsData }] = await Promise.all([
    buildPlansQuery(true),
    supabase.from('athletes').select('id, first_name, last_name').order('last_name', { ascending: true }),
    supabaseAdmin.from('profiles').select('id, first_name, last_name').eq('role', 'nutritionist').order('last_name', { ascending: true }),
    checkinsQuery,
  ]);

  // Fall back to query without file_path if the column doesn't exist yet
  const finalResult =
    plansResult.error?.message?.includes('file_path')
      ? await buildPlansQuery(false)
      : plansResult;

  const { data, error } = finalResult;
  const filePathSupported = !plansResult.error?.message?.includes('file_path');

  const plans = (data ?? []) as unknown as NutritionPlan[];
  const athletes = (athletesData ?? []) as { id: string; first_name: string; last_name: string }[];
  const nutritionists = (profilesData ?? []) as { id: string; first_name: string; last_name: string }[];
  const checkins = (checkinsData ?? []) as NutritionCheckin[];

  // Group all checkins by athlete (already sorted desc by checkin_date)
  const checkinsByAthlete = checkins.reduce<Record<string, NutritionCheckin[]>>((acc, c) => {
    if (!acc[c.athlete_id]) acc[c.athlete_id] = [];
    acc[c.athlete_id].push(c);
    return acc;
  }, {});

  // Generate signed download URLs only if column exists
  const signedUrls = await Promise.all(
    plans.map((p) =>
      filePathSupported && p.file_path ? getNutritionFileUrl(p.file_path) : Promise.resolve(null)
    )
  );

  return (
    <main className="p-8">
      <Link href="/follow-up" className="text-blue-600 hover:underline">
        ← Back to Follow-up
      </Link>

      <h1 className="text-3xl font-bold mt-4 mb-2">Nutrition</h1>
      <p className="text-gray-600 mb-8">Monitor dietary plans and nutritional goals.</p>

      <AthleteFilter athletes={athletes} selectedId={selectedAthleteId} />

      <CheckinChart
        checkins={selectedAthleteId ? (checkinsByAthlete[selectedAthleteId] ?? []) : checkins}
      />

      <NewPlanForm athletes={athletes} nutritionists={nutritionists} />

      {error && (
        <div className="mb-4 rounded border border-red-300 bg-red-50 p-4 text-red-700">
          Error loading nutrition plans: {error.message}
        </div>
      )}

      {!error && plans.length === 0 && (
        <div className="rounded border border-gray-200 p-4 text-gray-600">
          No nutrition plans found yet.
        </div>
      )}

      <div className="space-y-4">
        {plans.map((plan, i) => (
          <div key={plan.id} className="rounded-lg border border-gray-200 p-5">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold">{plan.title}</h2>
                <p className="text-sm text-gray-600 mt-1">
                  {plan.athletes
                    ? `${plan.athletes.first_name} ${plan.athletes.last_name}`
                    : 'Unknown athlete'}
                </p>
              </div>
              <div className="flex items-center gap-2 self-start md:self-auto">
                <span
                  className={`text-xs font-medium px-2.5 py-1 rounded-full capitalize ${statusColors[plan.status] ?? 'bg-gray-100 text-gray-600'}`}
                >
                  {plan.status}
                </span>
                <PlanStatusSelect planId={plan.id} currentStatus={plan.status} />
              </div>
            </div>

            <div className="mt-3 text-sm text-gray-700 space-y-1">
              <p>
                <span className="font-medium">Nutritionist:</span>{' '}
                {plan.profiles
                  ? `${plan.profiles.first_name} ${plan.profiles.last_name}`
                  : 'N/A'}
              </p>
              <p>
                <span className="font-medium">Period:</span>{' '}
                {new Date(plan.start_date).toLocaleDateString()}
                {plan.end_date ? ` – ${new Date(plan.end_date).toLocaleDateString()}` : ' (ongoing)'}
              </p>
            </div>

            {plan.athlete_id && (
              <CheckinForm
                athleteId={plan.athlete_id}
                nutritionists={nutritionists}
                previousCheckins={checkinsByAthlete[plan.athlete_id] ?? []}
              />
            )}

            <div className="mt-3 flex items-center gap-3">
              {filePathSupported && <UploadButton planId={plan.id} hasFile={!!plan.file_path} />}
              {signedUrls[i] && (
                <a
                  href={signedUrls[i]!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:underline"
                >
                  ⤓ Download
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
