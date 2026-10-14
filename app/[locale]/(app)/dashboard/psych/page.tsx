import { redirect } from 'next/navigation';
import { getLocale } from 'next-intl/server';
import { requireAuthenticated } from '@/lib/rbac/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { PsychQuestionnaire } from '@/components/psych/PsychQuestionnaire';
import { isPsychAssessmentExpired, PSYCH_ASSESSMENT_WINDOW_MS } from '@/lib/psych/assessment-window';

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
  const locale = await getLocale();
  const expirationCutoff = new Date(Date.now() - PSYCH_ASSESSMENT_WINDOW_MS).toISOString();
  await supabaseAdmin
    .from('psych_assessments')
    .update({ status: 'expired' })
    .eq('athlete_id', user.profile.id)
    .eq('status', 'pending')
    .lt('scheduled_for', expirationCutoff);

  const { data: assessmentRaw } = await supabaseAdmin
    .from('psych_assessments')
    .select('id, scheduled_for, psych_instruments!inner(id, code, name, item_count, is_active, is_test_only, license_status)')
    .eq('athlete_id', user.profile.id)
    .eq('status', 'pending')
    .or(`scheduled_for.is.null,scheduled_for.lte.${new Date().toISOString()}`)
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
  const assessmentExpired = Boolean(assessment && isPsychAssessmentExpired(assessment.scheduled_for));
  if (assessmentExpired && assessment) {
    await supabaseAdmin
      .from('psych_assessments')
      .update({ status: 'expired' })
      .eq('id', assessment.id)
      .eq('status', 'pending');
  }

  const { data: itemRows } = instrument
    ? await supabaseAdmin
      .from('psych_instrument_items')
      .select('item_code, item_order, prompt_text, response_options, subscale_code, is_reverse_scored')
      .eq('instrument_id', instrument.id)
      .order('item_order')
    : { data: [] as InstrumentItem[] };
  const items = (itemRows ?? []) as InstrumentItem[];
  const { data: historyRows } = await supabaseAdmin
    .from('psych_assessments')
    .select('id, completed_at, psych_instruments!inner(name, is_test_only)')
    .eq('athlete_id', user.profile.id)
    .in('status', ['completed', 'under_review', 'approved'])
    .not('completed_at', 'is', null)
    .eq('psych_instruments.is_test_only', false)
    .order('completed_at', { ascending: false });
  const completedAssessments = (historyRows ?? []).map((rawAssessment) => {
    const assessment = rawAssessment as {
      id: string;
      completed_at: string;
      psych_instruments: { name: string } | { name: string }[] | null;
    };
    const instrument = Array.isArray(assessment.psych_instruments)
      ? assessment.psych_instruments[0]
      : assessment.psych_instruments;

    return {
      id: assessment.id,
      instrumentName: instrument?.name ?? 'Evaluación psicológica',
      completedAt: assessment.completed_at,
    };
  });
  const hasAvailableQuestionnaire = Boolean(
    assessment &&
    instrument &&
    !assessmentExpired &&
    items.length === instrument.item_count
  );


  return (
    <main className="max-w-6xl p-8">
      <header className="mb-8 border-l-4 border-[#C0172C] pl-4">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#C0172C]">Exámenes</p>
        <h1 className="mt-1 text-3xl font-bold text-[#2D2D2D]">Mi evaluación programada</h1>
        <p className="mt-2 max-w-2xl text-sm text-gray-600">
          Aquí podrás responder la evaluación psicológica que el equipo te haya programado.
        </p>
      </header>

      <section className="mb-10">
        {hasAvailableQuestionnaire && assessment && instrument ? (
          <PsychQuestionnaire assessmentId={assessment.id} instrumentCode={instrument.code} instrumentName={instrument.name} items={items} />
        ) : (
          <div className="rounded-2xl border border-dashed border-red-200 bg-red-50 px-6 py-10 text-center">
            <p className="text-lg font-bold text-[#2D2D2D]">{assessmentExpired ? 'Esta evaluación venció.' : 'No hay ningún cuestionario disponible todavía'}</p>
            <p className="mx-auto mt-2 max-w-xl text-sm text-gray-600">
              {assessmentExpired ? 'Comunícate con tu equipo para que programe una nueva evaluación.' : 'Cuando un instrumento esté autorizado y el equipo programe una evaluación para ti, aparecerá aquí.'}
            </p>
          </div>
        )}
      </section>
      <section>
        <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-[#C0172C]">Historial</h2>
        <h2 className="mt-1 text-2xl font-bold text-[#2D2D2D]">Exámenes contestados</h2>
        <div className="mt-4 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          {completedAssessments.length === 0 ? <p className="px-6 py-8 text-sm text-gray-500">Aún no tienes exámenes contestados.</p> : completedAssessments.map((assessment) => (
            <div key={assessment.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-4 last:border-0">
              <p className="font-semibold text-[#2D2D2D]">{assessment.instrumentName}</p>
              <p className="text-sm text-gray-500">{new Date(assessment.completedAt).toLocaleDateString(locale)}</p>
            </div>
          ))}
        </div>
      </section>

    </main>
  );
}
