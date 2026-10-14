import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/rbac/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user?.profile || !user.roles.some((role) => role.code === 'mental_health_admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('psych_assessments')
    .select('id, completed_at, published_to_athlete, profiles(first_name, last_name), psych_instruments!inner(name, is_test_only)')
    .eq('status', 'under_review')
    .eq('published_to_athlete', false)
    .eq('psych_instruments.is_test_only', false)
    .order('completed_at', { ascending: false });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const assessments = (data ?? []).map((rawAssessment) => {
    const assessment = rawAssessment as {
      id: string;
      completed_at: string | null;
      published_to_athlete: boolean;
      profiles: { first_name: string; last_name: string } | { first_name: string; last_name: string }[] | null;
      psych_instruments: { name: string } | { name: string }[] | null;
    };
    const athlete = Array.isArray(assessment.profiles) ? assessment.profiles[0] : assessment.profiles;
    const instrument = Array.isArray(assessment.psych_instruments) ? assessment.psych_instruments[0] : assessment.psych_instruments;

    return {
      id: assessment.id,
      athleteName: athlete ? `${athlete.first_name} ${athlete.last_name}`.trim() : 'Atleta',
      instrumentName: instrument?.name ?? 'Instrumento',
      completedAt: assessment.completed_at,
      status: 'under_review' as const,
      published: assessment.published_to_athlete,
    };
  });

  return NextResponse.json(
    { assessments },
    { headers: { 'Cache-Control': 'private, no-store, max-age=0' } }
  );
}
