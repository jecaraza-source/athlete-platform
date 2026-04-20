import { notFound }        from 'next/navigation';
import BackButton          from '@/components/back-button';
import { getTranslations } from 'next-intl/server';
import { requireAuthenticated } from '@/lib/rbac/server';
import {
  getPlansByType,
  getPlanSignedUrl,
  getActiveAthletes,
  getMyPlansForAthlete,
  type PlanType,
} from '@/lib/plans/actions';
import { PlanForm }  from '@/components/plans/plan-form';
import { PlansList } from '@/components/plans/plans-list';

export const dynamic = 'force-dynamic';

// ── Discipline metadata ──────────────────────────────────────────────────────
type Meta = {
  label:       string;
  description: string;
  accent:      string;  // Tailwind text colour for heading
  border:      string;  // border-l colour class
};

const DISCIPLINES: Record<PlanType, Meta> = {
  medical: {
    label:       'Plan Médico',
    description: 'Planes de atención, exámenes y seguimiento médico por atleta.',
    accent:      'text-rose-700',
    border:      'border-rose-400',
  },
  nutrition: {
    label:       'Plan Alimentario',
    description: 'Planes dietéticos y nutricionales personalizados.',
    accent:      'text-emerald-700',
    border:      'border-emerald-400',
  },
  psychology: {
    label:       'Plan Psicológico',
    description: 'Programas de bienestar mental y rendimiento psicológico.',
    accent:      'text-purple-700',
    border:      'border-purple-400',
  },
  training: {
    label:       'Plan de Entrenamiento',
    description: 'Programas de carga, periodización y desarrollo físico.',
    accent:      'text-blue-700',
    border:      'border-blue-400',
  },
  rehabilitation: {
    label:       'Plan de Rehabilitación',
    description: 'Protocolos de recuperación y readaptación post-lesión.',
    accent:      'text-orange-700',
    border:      'border-orange-400',
  },
};

// ── Page ────────────────────────────────────────────────────────────────────
export default async function PlansDisciplinePage({
  params,
}: {
  params: Promise<{ discipline: string }>;
}) {
  const currentUser = await requireAuthenticated();

  const { discipline } = await params;

  if (!Object.keys(DISCIPLINES).includes(discipline)) {
    notFound();
  }

  const type = discipline as PlanType;
  const meta = DISCIPLINES[type];

  // Determine role: athletes get a read-only, filtered view of their own plans
  const isAthlete = currentUser.roles.some((r) => r.code === 'athlete');

  // Parallel data fetches — athletes only see their own published plans
  const [plans, athletes, tp, tc] = await Promise.all([
    isAthlete ? getMyPlansForAthlete(type) : getPlansByType(type),
    isAthlete ? Promise.resolve([])        : getActiveAthletes(),
    getTranslations('plans'),
    getTranslations('common'),
  ]);

  // Generate signed URLs for plans that have a file
  const signedUrls: Record<string, string | null> = {};
  await Promise.all(
    plans
      .filter((p) => p.file_path)
      .map(async (p) => {
        signedUrls[p.id] = await getPlanSignedUrl(p.file_path!);
      })
  );

  return (
    <main className="p-8 max-w-6xl">
      <BackButton href="/plans" label={tp('backToPlans')} />

      <div className={`mt-4 mb-6 pl-4 border-l-4 ${meta.border}`}>
        <h1 className={`text-2xl font-bold ${meta.accent}`}>{meta.label}</h1>
        <p className="text-sm text-gray-500 mt-1">{meta.description}</p>
      </div>

      {/*
       * Layout:
       *   Athletes  → 1 column, read-only plan list (no create form)
       *   Staff/Admin → 2 columns: plan list + create form
       */}
      <div className={`grid gap-8 items-start ${
        isAthlete ? 'grid-cols-1 max-w-xl' : 'grid-cols-1 lg:grid-cols-2'
      }`}>

        {/* ── Plan list ───────────────────────────────────────── */}
        <section>
          <h2 className="text-base font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <span>{isAthlete ? tp('myPlansTitle') : tp('staffPlansTitle')}</span>
            {plans.length > 0 && (
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500 font-normal">
                {plans.length}
              </span>
            )}
          </h2>

          {plans.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 py-12 text-center">
              <p className="text-sm text-gray-400 font-medium">
                {isAthlete ? tp('athleteEmpty') : tp('staffEmpty')}
              </p>
              {!isAthlete && (
                <p className="text-xs text-gray-400 mt-1">
                  {tp('staffEmptyHint')}
                </p>
              )}
            </div>
          ) : (
            <PlansList
              plans={plans}
              signedUrls={signedUrls}
              readOnly={isAthlete}
            />
          )}
        </section>

        {/* ── Create form — staff / admin only ─────────────────── */}
        {!isAthlete && (
          <section>
            <h2 className="text-base font-semibold text-gray-800 mb-4">
              {tp('newPlanTitle')}
            </h2>
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <PlanForm type={type} athletes={athletes} />
            </div>
          </section>
        )}

      </div>
    </main>
  );
}
