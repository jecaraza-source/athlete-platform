import { redirect } from 'next/navigation';
import { requireAuthenticated } from '@/lib/rbac/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

const SEVERITY_ORDER: Record<string, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

export default async function CoachPsychDashboardPage() {
  const user = await requireAuthenticated();
  if (
    !user.profile ||
    !user.roles.some((role) => role.code === 'coach') ||
    !user.permissions.has('psych.read_interpreted')
  ) {
    redirect('/dashboard');
  }

  const { data: assignmentRows } = await supabaseAdmin
    .from('psych_coach_athlete_assignments')
    .select('athlete_profile_id')
    .eq('coach_profile_id', user.profile.id)
    .is('unassigned_at', null);
  const athleteProfileIds = [...new Set(
    (assignmentRows ?? []).map((assignment: { athlete_profile_id: string }) => assignment.athlete_profile_id)
  )];

  const [{ data: profileRows }, { data: assessmentRows }] = athleteProfileIds.length > 0
    ? await Promise.all([
        supabaseAdmin
          .from('profiles')
          .select('id, first_name, last_name, avatar_url')
          .in('id', athleteProfileIds)
          .order('last_name'),
        supabaseAdmin
          .from('psych_assessments')
          .select('id, athlete_id, completed_at, psych_instruments!inner(name, is_test_only)')
          .in('athlete_id', athleteProfileIds)
          .eq('status', 'completed')
          .eq('psych_instruments.is_test_only', false)
          .order('completed_at', { ascending: false }),
      ])
    : [{ data: [] }, { data: [] }];

  const latestAssessmentByAthlete = new Map<string, { id: string; completed_at: string | null; instrumentName: string }>();
  for (const rawAssessment of assessmentRows ?? []) {
    const assessment = rawAssessment as {
      id: string;
      athlete_id: string;
      completed_at: string | null;
      psych_instruments: { name: string } | { name: string }[] | null;
    };
    if (latestAssessmentByAthlete.has(assessment.athlete_id)) continue;
    const instrument = Array.isArray(assessment.psych_instruments)
      ? assessment.psych_instruments[0]
      : assessment.psych_instruments;
    latestAssessmentByAthlete.set(assessment.athlete_id, {
      id: assessment.id,
      completed_at: assessment.completed_at,
      instrumentName: instrument?.name ?? 'Instrumento',
    });
  }

  const latestAssessmentIds = [...latestAssessmentByAthlete.values()].map((assessment) => assessment.id);
  const { data: scoreRows } = latestAssessmentIds.length > 0
    ? await supabaseAdmin
      .from('psych_scores')
      .select('assessment_id, subscale_code, band, interpretation_text')
      .in('assessment_id', latestAssessmentIds)
    : { data: [] };
  const scoresByAssessment = new Map<string, Array<{
    subscale_code: string;
    band: string | null;
    interpretation_text: string | null;
  }>>();
  for (const score of scoreRows ?? []) {
    const row = score as {
      assessment_id: string;
      subscale_code: string;
      band: string | null;
      interpretation_text: string | null;
    };
    const scores = scoresByAssessment.get(row.assessment_id) ?? [];
    scores.push(row);
    scoresByAssessment.set(row.assessment_id, scores);
  }

  const { data: alertRows } = athleteProfileIds.length > 0
    ? await supabaseAdmin
      .from('psych_alerts')
      .select('id, athlete_id, alert_type, severity, created_at, psych_assessments!inner(psych_instruments!inner(is_test_only))')
      .in('athlete_id', athleteProfileIds)
      .eq('status', 'open')
      .eq('psych_assessments.psych_instruments.is_test_only', false)
      .order('created_at', { ascending: false })
    : { data: [] };
  const athleteNameById = new Map(
    (profileRows ?? []).map((profile: { id: string; first_name: string; last_name: string }) => [
      profile.id,
      `${profile.first_name} ${profile.last_name}`.trim(),
    ])
  );
  const alerts = (alertRows ?? [])
    .map((alert) => alert as {
      id: string;
      athlete_id: string;
      alert_type: string;
      severity: 'low' | 'medium' | 'high';
      created_at: string;
    })
    .sort((left, right) => SEVERITY_ORDER[left.severity] - SEVERITY_ORDER[right.severity]);

  return (
    <main className="max-w-7xl p-8">
      <header className="mb-8 border-l-4 border-[#C0172C] pl-4">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#C0172C]">Cuerpo técnico</p>
        <h1 className="mt-1 text-3xl font-bold text-[#2D2D2D]">Perfil psicológico del equipo</h1>
        <p className="mt-2 text-sm text-gray-600">
          Consulta únicamente interpretaciones y alertas abiertas de los atletas asignados a tu roster.
        </p>
      </header>

      <section className="mb-10">
        <h2 className="mb-4 text-xl font-bold text-[#2D2D2D]">Atletas asignados</h2>
        {athleteProfileIds.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-6 py-10 text-center text-sm text-gray-500">
            No hay atletas asignados a tu roster psicológico.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {(profileRows ?? []).map((profile) => {
              const athlete = profile as { id: string; first_name: string; last_name: string };
              const assessment = latestAssessmentByAthlete.get(athlete.id);
              const scores = assessment ? scoresByAssessment.get(assessment.id) ?? [] : [];
              return (
                <article key={athlete.id} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                  <h3 className="text-lg font-bold text-[#2D2D2D]">
                    {`${athlete.first_name} ${athlete.last_name}`.trim()}
                  </h3>
                  {assessment ? (
                    <>
                      <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-[#C0172C]">{assessment.instrumentName}</p>
                      <p className="mt-1 text-xs text-gray-500">
                        Última evaluación: {assessment.completed_at
                          ? new Date(assessment.completed_at).toLocaleDateString('es-MX')
                          : 'sin fecha'}
                      </p>
                      <div className="mt-4 space-y-2">
                        {scores.length > 0 ? scores.map((score) => (
                          <div key={score.subscale_code} className="rounded-lg bg-gray-50 px-3 py-2">
                            <p className="text-xs font-semibold capitalize text-gray-700">{score.subscale_code.replaceAll('_', ' ')}</p>
                            <p className="text-sm font-bold text-[#2D2D2D]">{score.band ?? 'Sin banda definida'}</p>
                            {score.interpretation_text && (
                              <p className="mt-1 text-xs text-gray-600">{score.interpretation_text}</p>
                            )}
                          </div>
                        )) : (
                          <p className="text-sm text-gray-500">Aún no hay interpretación disponible.</p>
                        )}
                      </div>
                    </>
                  ) : (
                    <p className="mt-4 text-sm text-gray-500">Aún no hay una evaluación psicológica interpretada.</p>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-[#2D2D2D]">Alertas abiertas</h2>
          <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-[#C0172C]">{alerts.length}</span>
        </div>
        {alerts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-6 py-10 text-center text-sm text-gray-500">
            No hay alertas abiertas para tu equipo.
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            {alerts.map((alert) => (
              <div key={alert.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-4 last:border-0">
                <div>
                  <p className="font-semibold text-[#2D2D2D]">{athleteNameById.get(alert.athlete_id) ?? 'Atleta asignado'}</p>
                  <p className="text-sm text-gray-600">{alert.alert_type.replaceAll('_', ' ')}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${
                  alert.severity === 'high'
                    ? 'bg-red-50 text-red-800'
                    : alert.severity === 'medium'
                      ? 'bg-amber-50 text-amber-800'
                      : 'bg-sky-50 text-sky-800'
                }`}>
                  {alert.severity}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
