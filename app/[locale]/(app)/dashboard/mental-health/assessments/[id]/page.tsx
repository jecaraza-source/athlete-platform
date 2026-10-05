import { notFound, redirect } from 'next/navigation';
import { requireAuthenticated } from '@/lib/rbac/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { AssessmentDetailEditor } from '@/components/psych/AssessmentDetailEditor';

export const dynamic = 'force-dynamic';

export default async function MentalHealthAssessmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuthenticated();
  if (!user.profile || !user.roles.some((role) => role.code === 'mental_health_admin') || !user.permissions.has('psych.read_raw')) {
    redirect('/dashboard');
  }

  const { id } = await params;
  const { data: assessmentRaw } = await supabaseAdmin
    .from('psych_assessments')
    .select('id, status, published_to_athlete, clinical_summary, reviewed_at, approved_at, profiles(first_name, last_name), psych_instruments!inner(name, is_test_only)')
    .eq('id', id)
    .eq('psych_instruments.is_test_only', false)
    .maybeSingle();
  if (!assessmentRaw) notFound();

  const assessment = assessmentRaw as {
    id: string;
    status: string;
    published_to_athlete: boolean;
    clinical_summary: string | null;
    reviewed_at: string | null;
    approved_at: string | null;
    profiles: { first_name: string; last_name: string } | { first_name: string; last_name: string }[] | null;
    psych_instruments: { name: string } | { name: string }[] | null;
  };
  const athlete = Array.isArray(assessment.profiles) ? assessment.profiles[0] : assessment.profiles;
  const instrument = Array.isArray(assessment.psych_instruments) ? assessment.psych_instruments[0] : assessment.psych_instruments;
  const [{ data: responseRows }, { data: scoreRows }] = await Promise.all([
    supabaseAdmin.from('psych_responses').select('item_code, raw_value, created_at').eq('assessment_id', assessment.id).order('item_code'),
    supabaseAdmin.from('psych_scores').select('id, subscale_code, raw_score, band, interpretation_text').eq('assessment_id', assessment.id).order('subscale_code'),
  ]);

  return (
    <main className="max-w-7xl p-8">
      <header className="mb-8 border-l-4 border-[#C0172C] pl-4">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#C0172C]">Assessment clínico</p>
        <h1 className="mt-1 text-3xl font-bold text-[#2D2D2D]">{athlete ? `${athlete.first_name} ${athlete.last_name}`.trim() : 'Atleta'}</h1>
        <p className="mt-2 text-sm text-gray-600">{instrument?.name ?? 'Instrumento'} · Estado: {assessment.status}</p>
      </header>
      <AssessmentDetailEditor
        assessmentId={assessment.id}
        assessmentStatus={assessment.status}
        published={assessment.published_to_athlete}
        clinicalSummary={assessment.clinical_summary ?? ''}
        reviewedAt={assessment.reviewed_at}
        approvedAt={assessment.approved_at}
        canEdit={user.permissions.has('psych.write_interpretation') && assessment.status === 'under_review' && !assessment.published_to_athlete}
        canPublish={user.permissions.has('psych.publish_to_athlete')}
        scores={(scoreRows ?? []).map((score) => ({ id: score.id as string, subscaleCode: score.subscale_code as string, rawScore: Number(score.raw_score), band: score.band as string | null, interpretationText: score.interpretation_text as string | null }))}
        responses={(responseRows ?? []).map((response) => ({ itemCode: response.item_code as string, rawValue: response.raw_value as string, createdAt: response.created_at as string }))}
      />
    </main>
  );
}
