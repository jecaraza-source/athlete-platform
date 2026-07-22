import { redirect } from 'next/navigation';
import { getLocale } from 'next-intl/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requirePermission, getDiagnosticAccess } from '@/lib/rbac/server';
import BackButton from '@/components/back-button';
import DiagnosticTabs from './diagnostic-tabs';
import AttachmentsLoader from '@/components/attachments/attachments-loader';
import { SECTION_KEYS, type DiagnosticSectionKey } from '@/lib/types/diagnostic';
import { getTrainingPlansForAthlete, getPlanSignedUrl } from '@/lib/plans/actions';

export const dynamic = 'force-dynamic';

export default async function DiagnosticPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission('view_athletes');
  const { id } = await params;

  // Enforce section-level access control.
  // Roles without any allowed section are redirected to the athlete profile
  // where they can still see the overall completion status.
  const { allowedSections, canViewIntegratedResult } = await getDiagnosticAccess();
  if (allowedSections.length === 0) {
    redirect(`/${await getLocale()}/athletes/${id}`);
  }

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

  // Fetch evaluations only for sections the current user is allowed to see.
  // This prevents sensitive data from being serialised into client component props.
  const [medicalEval, nutritionEval, psychologyEval, coachEval, physioEval, integratedResults] =
    await Promise.all([
      allowedSections.includes('medico')
        ? fetchEval('athlete_medical_evaluation',       'medico')
        : Promise.resolve(null),
      allowedSections.includes('nutricion')
        ? fetchEval('athlete_nutrition_evaluation',     'nutricion')
        : Promise.resolve(null),
      allowedSections.includes('psicologia')
        ? fetchEval('athlete_psychology_evaluation',    'psicologia')
        : Promise.resolve(null),
      allowedSections.includes('entrenador')
        ? fetchEval('athlete_coach_evaluation',         'entrenador')
        : Promise.resolve(null),
      allowedSections.includes('fisioterapia')
        ? fetchEval('athlete_physiotherapy_evaluation', 'fisioterapia')
        : Promise.resolve(null),
      canViewIntegratedResult && diagnostic?.id
        ? supabaseAdmin
            .from('athlete_integrated_results')
            .select('*')
            .eq('diagnostic_id', diagnostic.id)
            .maybeSingle()
            .then((r) => r.data)
        : Promise.resolve(null),
    ]);

  // Construir los paneles de adjuntos solo para las secciones que el usuario puede ver.
  const attachmentPanels = Object.fromEntries(
    SECTION_KEYS
      .filter((key) => allowedSections.includes(key))
      .map((key) => [
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

  // Fetch training plans for the athlete — only when the coach section is accessible
  const trainingPlans = allowedSections.includes('entrenador')
    ? await getTrainingPlansForAthlete(id)
    : [];

  const trainingPlanSignedUrls: Record<string, string | null> = {};
  await Promise.all(
    trainingPlans
      .filter((p) => p.file_path)
      .map(async (p) => {
        trainingPlanSignedUrls[p.id] = await getPlanSignedUrl(p.file_path!);
      })
  );

  // Panel de estudios de laboratorio y gabinete — solo si el usuario puede ver la sección médica.
  const labStudiesPanel = allowedSections.includes('medico') ? (
    <AttachmentsLoader
      athleteId={id}
      module="diagnostic"
      sectionName="estudios_laboratorio"
      relatedRecordId={sectionMap['medico']?.id}
      title="Adjuntar estudios de laboratorio y gabinete"
      defaultCollapsed={false}
    />
  ) : undefined;

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
        labStudiesPanel={labStudiesPanel}
        allowedSections={allowedSections}
        canViewIntegratedResult={canViewIntegratedResult}
        trainingPlans={trainingPlans}
        trainingPlanSignedUrls={trainingPlanSignedUrls}
      />
    </main>
  );
}
