import { redirect } from 'next/navigation';
import { requireAuthenticated } from '@/lib/rbac/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { PsychQuestionnaire } from '@/components/psych/PsychQuestionnaire';
import { PsychTrendChart } from '@/components/psych/PsychTrendChart';

export const dynamic = 'force-dynamic';

type Instrument = {
  id: string;
  code: string;
  name: string;
  item_count: number;
  is_active: boolean;
  is_test_only: boolean;
  license_status: 'pending_review' | 'licensed' | 'not_required' | 'denied';
};

type InstrumentItem = {
  item_code: string;
  item_order: number;
  prompt_text: string;
  response_options: unknown;
  subscale_code: string;
  is_reverse_scored: boolean;
};

export default async function AthletePsychDashboardPage() {
  const user = await requireAuthenticated();
  if (!user.profile || !user.roles.some((role) => role.code === 'athlete')) {
    redirect('/dashboard');
  }

  const { data: assessmentRaw } = await supabaseAdmin
    .from('psych_assessments')
    .select('id, scheduled_for, psych_instruments!inner(id, code, name, item_count, is_active, is_test_only, license_status)')
    .eq('athlete_id', user.profile.id)
    .eq('status', 'pending')
    .eq('psych_instruments.is_active', true)
    .eq('psych_instruments.is_test_only', false)
    .in('psych_instruments.license_status', ['licensed', 'not_required'])
    .order('scheduled_for', { ascending: true })
    .limit(1)
    .maybeSingle();

  const assessment = assessmentRaw as {
    id: string;
    scheduled_for: string | null;
    psych_instruments: Instrument | Instrument[] | null;
  } | null;
  const instrument = Array.isArray(assessment?.psych_instruments)
    ? assessment?.psych_instruments[0]
    : assessment?.psych_instruments;

  const { data: itemRows } = instrument
    ? await supabaseAdmin
      .from('psych_instrument_items')
      .select('item_code, item_order, prompt_text, response_options, subscale_code, is_reverse_scored')
      .eq('instrument_id', instrument.id)
      .order('item_order')
    : { data: [] as InstrumentItem[] };
  const items = (itemRows ?? []) as InstrumentItem[];
  const hasAvailableQuestionnaire = Boolean(
    assessment &&
    instrument &&
    items.length === instrument.item_count
  );

  const { data: publishedAssessmentsRaw } = await supabaseAdmin
    .from('psych_assessments')
    .select('id, completed_at, psych_instruments!inner(is_test_only)')
    .eq('athlete_id', user.profile.id)
    .eq('published_to_athlete', true)
    .eq('psych_instruments.is_test_only', false)
    .not('completed_at', 'is', null)
    .order('completed_at', { ascending: true });

  const publishedAssessments = (publishedAssessmentsRaw ?? []) as Array<{
    id: string;
    completed_at: string;
  }>;
  const assessmentDates = new Map(publishedAssessments.map((row) => [row.id, row.completed_at]));
  const { data: scoreRows } = publishedAssessments.length > 0
    ? await supabaseAdmin
      .from('psych_scores')
      .select('assessment_id, subscale_code, raw_score')
      .in('assessment_id', publishedAssessments.map((row) => row.id))
    : { data: [] as Array<{ assessment_id: string; subscale_code: string; raw_score: number }> };

  const trends = (scoreRows ?? []).reduce<Record<string, Array<{ completedAt: string; rawScore: number }>>>(
    (accumulator, score) => {
      const completedAt = assessmentDates.get(score.assessment_id);
      if (!completedAt) return accumulator;
      const points = accumulator[score.subscale_code] ?? [];
      points.push({ completedAt, rawScore: Number(score.raw_score) });
      accumulator[score.subscale_code] = points;
      return accumulator;
    },
    {}
  );

  return (
    <main className="max-w-6xl p-8">
      <header className="mb-8 border-l-4 border-[#C0172C] pl-4">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#C0172C]">Perfil Psicológico</p>
        <h1 className="mt-1 text-3xl font-bold text-[#2D2D2D]">Mi bienestar deportivo</h1>
        <p className="mt-2 max-w-2xl text-sm text-gray-600">
          Consulta tus evaluaciones disponibles y los resultados que el equipo de salud mental haya publicado para ti.
        </p>
      </header>

      <section className="mb-10">
        {hasAvailableQuestionnaire && assessment && instrument ? (
          <PsychQuestionnaire assessmentId={assessment.id} instrumentCode={instrument.code} instrumentName={instrument.name} items={items} />
        ) : (
          <div className="rounded-2xl border border-dashed border-red-200 bg-red-50 px-6 py-10 text-center">
            <p className="text-lg font-bold text-[#2D2D2D]">No hay ningún cuestionario disponible todavía</p>
            <p className="mx-auto mt-2 max-w-xl text-sm text-gray-600">
              Cuando un instrumento esté autorizado y el equipo programe una evaluación para ti, aparecerá aquí.
            </p>
          </div>
        )}
      </section>

      <section>
        <div className="mb-4">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#C0172C]">Resultados publicados</p>
          <h2 className="mt-1 text-2xl font-bold text-[#2D2D2D]">Mi tendencia por subescala</h2>
        </div>
        <PsychTrendChart trends={trends} />
      </section>
    </main>
  );
}
