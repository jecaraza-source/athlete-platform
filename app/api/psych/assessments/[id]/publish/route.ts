import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/rbac/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'nodejs';

export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user?.profile) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (
    !user.roles.some((role) => role.code === 'mental_health_admin') ||
    !user.permissions.has('psych.publish_to_athlete')
  ) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id: assessmentId } = await params;
  const { data: assessment, error: readError } = await supabaseAdmin
    .from('psych_assessments')
    .select('id, status, approved_by, approved_at, clinical_summary, psych_instruments!inner(is_test_only)')
    .eq('id', assessmentId)
    .eq('psych_instruments.is_test_only', false)
    .maybeSingle();

  if (readError || !assessment) {
    return NextResponse.json({ error: 'Assessment not found' }, { status: 404 });
  }
  if (
    assessment.status !== 'approved' ||
    !assessment.approved_by ||
    !assessment.approved_at ||
    !assessment.clinical_summary?.trim()
  ) {
    return NextResponse.json(
      { error: 'Only clinically approved assessments with a summary can be published.' },
      { status: 409 }
    );
  }

  const { error: updateError } = await supabaseAdmin
    .from('psych_assessments')
    .update({
      published_to_athlete: true,
      published_by: user.profile.id,
      published_at: new Date().toISOString(),
    })
    .eq('id', assessmentId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, assessmentId, published_to_athlete: true });
}
