import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder-anon-key',
    { global: { headers: { Authorization: authorization } } }
  );
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('auth_user_id', user.id)
    .maybeSingle();
  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }

  const { id: assessmentId } = await params;
  const allowTechnicalFixtures = process.env.PSYCH_ALLOW_TEST_FIXTURES === 'true';
  let assessmentQuery = supabaseAdmin
    .from('psych_assessments')
    .select('id, psych_instruments!inner(id, name, item_count, is_active, is_test_only, license_status)')
    .eq('id', assessmentId)
    .eq('athlete_id', profile.id)
    .eq('status', 'pending')
    .eq('psych_instruments.is_active', true)
    .in('psych_instruments.license_status', ['licensed', 'not_required']);
  if (!allowTechnicalFixtures) {
    assessmentQuery = assessmentQuery.eq('psych_instruments.is_test_only', false);
  }
  const { data: rawAssessment } = await assessmentQuery.maybeSingle();

  if (!rawAssessment) {
    return NextResponse.json({ error: 'No questionnaire is available for this assessment.' }, { status: 404 });
  }

  const assessment = rawAssessment as {
    id: string;
    psych_instruments: {
      id: string;
      name: string;
      item_count: number;
    } | Array<{
      id: string;
      name: string;
      item_count: number;
    }> | null;
  };
  const instrument = Array.isArray(assessment.psych_instruments)
    ? assessment.psych_instruments[0]
    : assessment.psych_instruments;
  if (!instrument) {
    return NextResponse.json({ error: 'Instrument not found.' }, { status: 404 });
  }

  const { data: items } = await supabaseAdmin
    .from('psych_instrument_items')
    .select('item_code, item_order, prompt_text, response_options')
    .eq('instrument_id', instrument.id)
    .order('item_order');
  if (!items || items.length !== instrument.item_count) {
    return NextResponse.json({ error: 'Questionnaire items are not available.' }, { status: 503 });
  }

  return NextResponse.json({
    assessmentId: assessment.id,
    instrumentName: instrument.name,
    items,
  });
}
