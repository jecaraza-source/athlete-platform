import { supabaseAdmin } from '@/lib/supabase-admin';
import { requirePermission } from '@/lib/rbac/server';
import BackButton from '@/components/back-button';
import DiagnosticTabs from './diagnostic-tabs';
import AttachmentsLoader from '@/components/attachments/attachments-loader';
import { SECTION_KEYS, type DiagnosticSectionKey } from '@/lib/types/diagnostic';

export const dynamic = 'force-dynamic';

export default async function DiagnosticPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission('view_athletes');
  const { id } = await params;

  const [
    { data: athlete },
    { data: diagnostic },
    { data: sections },
  ] = await Promise.all([
    supabaseAdmin
      .from('athletes')
      .select('id, first_name, last_name, discipline, disability_status, status')
      .eq('id', id)
      .single(),
    supabaseAdmin
      .from('athlete_initial_diagnostic')
      .select('*')
      .eq('athlete_id', id)
      .maybeSingle(),
    supabaseAdmin
      .from('athlete_diagnostic_sections')
      .select('*')
      .eq('athlete_id', id),
  ]);

  if (!athlete) {
    return (
      <main className="p-8">
        <BackButton href="/athletes" label="Volver a Atletas" />
        <p className="mt-4 text-red-600">Atleta no encontrado.</p>
      </main>
    );
  }

  // Obtener IDs de cada sección para las queries de evaluación
  const sectionMap = Object.fromEntries((sections ?? []).map((s) => [s.section, s]));

  const fetchEval = async (table: string, sectionKey: string) => {
    const sectionId = sectionMap[sectionKey]?.id;
    if (!sectionId) return null;
    const { data } = await supabaseAdmin
      .from(table)
      .select('*')
      .eq('diagnostic_section_id', sectionId)
      .maybeSingle();
    return data;
  };

  // Fetch todas las evaluaciones e integración en paralelo
  const [medicalEval, nutritionEval, psychologyEval, coachEval, physioEval, integratedResults] =
    await Promise.all([
      fetchEval('athlete_medical_evaluation',        'medico'),
      fetchEval('athlete_nutrition_evaluation',      'nutricion'),
      fetchEval('athlete_psychology_evaluation',     'psicologia'),
      fetchEval('athlete_coach_evaluation',          'entrenador'),
      fetchEval('athlete_physiotherapy_evaluation',  'fisioterapia'),
      diagnostic?.id
        ? supabaseAdmin
            .from('athlete_integrated_results')
            .select('*')
            .eq('diagnostic_id', diagnostic.id)
            .maybeSingle()
            .then((r) => r.data)
        : Promise.resolve(null),
    ]);

  // Construir los paneles de adjuntos por sección (Server Components pasados como ReactNode)
  const attachmentPanels = Object.fromEntries(
    SECTION_KEYS.map((key) => [
      key,
      <AttachmentsLoader
        key={key}
        athleteId={id}
        module="diagnostic"
        sectionName={key}
        relatedRecordId={sectionMap[key]?.id}
        title="Documentos anexos de esta sección"
        defaultCollapsed
      />,
    ])
  ) as Partial<Record<DiagnosticSectionKey, React.ReactNode>>;

  return (
    <main className="p-6 max-w-7xl mx-auto">
      <div className="print:hidden">
        <BackButton href={`/athletes/${id}`} label="Volver al Expediente" />
      </div>
      <DiagnosticTabs
        athlete={athlete}
        diagnostic={diagnostic}
        sections={sections ?? []}
        evaluations={{
          medico:       medicalEval,
          nutricion:    nutritionEval,
          psicologia:   psychologyEval,
          entrenador:   coachEval,
          fisioterapia: physioEval,
        }}
        integratedResults={integratedResults}
        attachmentPanels={attachmentPanels}
      />
    </main>
  );
}
