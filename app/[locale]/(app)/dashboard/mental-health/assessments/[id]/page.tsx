import { notFound, redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { requireAuthenticated } from '@/lib/rbac/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { buildReadableResponses, type ReviewItem, type ReviewResponse } from '@/lib/psych/responses';
import { AssessmentDetailEditor } from '@/components/psych/AssessmentDetailEditor';

export const dynamic = 'force-dynamic';

export default async function MentalHealthAssessmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuthenticated();
  if (!user.profile || !user.roles.some((role) => role.code === 'mental_health_admin') || !user.permissions.has('psych.read_raw')) {
    redirect('/dashboard');
  }

  const [t, tc] = await Promise.all([getTranslations('psych.detail'), getTranslations('psych.common')]);
  const { id } = await params;
  const { data: assessmentRaw, error: assessmentError } = await supabaseAdmin
    .from('psych_assessments')
    .select('id, instrument_id, status, published_to_athlete, clinical_summary, athlete_summary, reviewed_at, approved_at, profiles!psych_assessments_athlete_id_fkey(first_name, last_name), psych_instruments!inner(name, is_test_only)')
    .eq('id', id)
    .eq('psych_instruments.is_test_only', false)
    .maybeSingle();
  if (assessmentError) throw new Error(`psych_assessments query failed: ${assessmentError.message}`);
  if (!assessmentRaw) notFound();

  const assessment = assessmentRaw as {
    id: string;
    instrument_id: string;
    status: string;
    published_to_athlete: boolean;
    clinical_summary: string | null;
    athlete_summary: string | null;
    reviewed_at: string | null;
    approved_at: string | null;
    profiles: { first_name: string; last_name: string } | { first_name: string; last_name: string }[] | null;
    psych_instruments: { name: string } | { name: string }[] | null;
  };
  const athlete = Array.isArray(assessment.profiles) ? assessment.profiles[0] : assessment.profiles;
  const instrument = Array.isArray(assessment.psych_instruments) ? assessment.psych_instruments[0] : assessment.psych_instruments;
  const [{ data: responseRows }, { data: scoreRows }, { data: itemRows }] = await Promise.all([
    supabaseAdmin.from('psych_responses').select('item_code, raw_value, created_at').eq('assessment_id', assessment.id),
    supabaseAdmin.from('psych_scores').select('id, subscale_code, raw_score, band, interpretation_text').eq('assessment_id', assessment.id).order('subscale_code'),
    // Clinicians may see the scoring key to grade instruments without automated scoring.
    supabaseAdmin.from('psych_instrument_items').select('item_code, item_order, prompt_text, response_options, subscale_code, is_reverse_scored').eq('instrument_id', assessment.instrument_id),
  ]);
  const statusLabel = tc.has(`assessmentStatus.${assessment.status}`) ? tc(`assessmentStatus.${assessment.status}`) : assessment.status;

  return (
    <main className="max-w-7xl p-8">
      <header className="mb-8 border-l-4 border-[#C0172C] pl-4">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#C0172C]">{t('eyebrow')}</p>
        <h1 className="mt-1 text-3xl font-bold text-[#2D2D2D]">{athlete ? `${athlete.first_name} ${athlete.last_name}`.trim() : tc('athleteFallback')}</h1>
        <p className="mt-2 text-sm text-gray-600">{t('statusLine', { instrument: instrument?.name ?? tc('instrumentFallback'), status: statusLabel })}</p>
      </header>
      <AssessmentDetailEditor
        assessmentId={assessment.id}
        assessmentStatus={assessment.status}
        published={assessment.published_to_athlete}
        clinicalSummary={assessment.clinical_summary ?? ''}
        athleteSummary={assessment.athlete_summary ?? ''}
        reviewedAt={assessment.reviewed_at}
        approvedAt={assessment.approved_at}
        canEdit={user.permissions.has('psych.write_interpretation') && assessment.status === 'under_review' && !assessment.published_to_athlete}
        canPublish={user.permissions.has('psych.publish_to_athlete')}
        scores={(scoreRows ?? []).map((score) => ({ id: score.id as string, subscaleCode: score.subscale_code as string, rawScore: Number(score.raw_score), band: score.band as string | null, interpretationText: score.interpretation_text as string | null }))}
        responses={buildReadableResponses((itemRows ?? []) as ReviewItem[], (responseRows ?? []) as ReviewResponse[])}
      />
    </main>
  );
}
