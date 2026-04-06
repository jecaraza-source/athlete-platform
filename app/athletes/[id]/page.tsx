import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { GeneralInfoSection, GuardianSection, EmergencyContactSection } from './athlete-sections';

export const dynamic = 'force-dynamic';

type AthleteDetail = {
  id: string;
  athlete_code: string | null;
  first_name: string;
  last_name: string;
  date_of_birth: string | null;
  sex: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  dominant_side: string | null;
  school_or_club: string | null;
  guardian_name: string | null;
  guardian_phone: string | null;
  guardian_email: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  medical_notes_summary: string | null;
  status: string;
};

function SectionHeader({ title, href }: { title: string; href: string }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="font-semibold text-base">{title}</h2>
      <Link href={href} className="text-xs text-blue-600 hover:underline">
        View all →
      </Link>
    </div>
  );
}

export default async function AthleteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [
    { data, error },
    { data: trainingSessions },
    { data: nutritionPlans },
    { data: physioCases },
    { data: psychologyCases },
    { data: eventParticipants },
  ] = await Promise.all([
    supabase
      .from('athletes')
      .select('id, athlete_code, first_name, last_name, date_of_birth, sex, height_cm, weight_kg, dominant_side, school_or_club, guardian_name, guardian_phone, guardian_email, emergency_contact_name, emergency_contact_phone, medical_notes_summary, status')
      .eq('id', id)
      .single(),
    supabaseAdmin
      .from('training_sessions')
      .select('id, title, session_date, location')
      .eq('athlete_id', id)
      .order('session_date', { ascending: false })
      .limit(5),
    supabaseAdmin
      .from('nutrition_plans')
      .select('id, title, start_date, end_date, status')
      .eq('athlete_id', id)
      .order('start_date', { ascending: false })
      .limit(5),
    supabaseAdmin
      .from('physio_cases')
      .select('id, status, opened_at, injuries(injury_type)')
      .eq('athlete_id', id)
      .order('opened_at', { ascending: false })
      .limit(5),
    supabaseAdmin
      .from('psychology_cases')
      .select('id, status, opened_at, summary')
      .eq('athlete_id', id)
      .order('opened_at', { ascending: false })
      .limit(5),
    supabaseAdmin
      .from('event_participants')
      .select('id, notes, events(id, title, event_type, start_at, status)')
      .eq('participant_id', id)
      .order('id', { ascending: false })
      .limit(5),
  ]);

  if (error || !data) {
    return (
      <main className="p-8">
        <Link href="/athletes" className="text-blue-600 hover:underline">
          ← Back to athletes
        </Link>
        <h1 className="text-2xl font-bold mt-4">Athlete not found</h1>
      </main>
    );
  }

  const athlete = data as AthleteDetail;

  const sessions = (trainingSessions ?? []) as { id: string; title: string; session_date: string; location: string | null }[];
  const plans = (nutritionPlans ?? []) as { id: string; title: string; start_date: string; end_date: string | null; status: string }[];
  const cases = (physioCases ?? []) as unknown as { id: string; status: string; opened_at: string; injuries: { injury_type: string } | null }[];
  const psychCases = (psychologyCases ?? []) as unknown as { id: string; status: string; opened_at: string; summary: string | null }[];
  const events = (eventParticipants ?? []) as unknown as { id: string; notes: string | null; events: { id: string; title: string; event_type: string; start_at: string; status: string } | null }[];

  return (
    <main className="p-8">
      <Link href="/athletes" className="text-blue-600 hover:underline">
        ← Back to athletes
      </Link>

      {/* Header */}
      <div className="mt-4 flex flex-col md:flex-row md:items-start md:justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">
            {athlete.first_name} {athlete.last_name}
          </h1>
          {athlete.athlete_code && (
            <p className="text-sm text-gray-500 mt-0.5">Code: {athlete.athlete_code}</p>
          )}
        </div>
        <span className={`self-start text-xs font-medium px-3 py-1 rounded-full capitalize ${
          athlete.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
        }`}>
          {athlete.status}
        </span>
      </div>

      {/* Profile info */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-8">
        <GeneralInfoSection athlete={athlete} />
        <GuardianSection athlete={athlete} />
        <EmergencyContactSection athlete={athlete} />
      </div>

      {/* Calendar */}
      <div className="mt-8 rounded-lg border border-gray-200 p-5">
        <SectionHeader title="Calendar" href="/calendar" />
        {events.length === 0 ? (
          <p className="text-sm text-gray-500">No events found.</p>
        ) : (
          <div className="space-y-2">
            {events.map((ep) => ep.events && (
              <div key={ep.id} className="flex items-center justify-between text-sm">
                <div>
                  <span className="font-medium">{ep.events.title}</span>
                  <span className="ml-2 text-gray-500 capitalize">{ep.events.event_type}</span>
                </div>
                <span className="text-gray-500">
                  {new Date(ep.events.start_at).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Follow-up */}
      <h2 className="text-xl font-bold mt-8 mb-4">Follow-up</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* Training */}
        <div className="rounded-lg border border-gray-200 p-5">
          <SectionHeader title="Training" href={`/follow-up/training`} />
          {sessions.length === 0 ? (
            <p className="text-sm text-gray-500">No sessions found.</p>
          ) : (
            <div className="space-y-2">
              {sessions.map((s) => (
                <div key={s.id} className="text-sm">
                  <p className="font-medium">{s.title}</p>
                  <p className="text-gray-500">{new Date(s.session_date).toLocaleDateString()}{s.location ? ` · ${s.location}` : ''}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Nutrition */}
        <div className="rounded-lg border border-gray-200 p-5">
          <SectionHeader title="Nutrition" href={`/follow-up/nutrition?athlete=${id}`} />
          {plans.length === 0 ? (
            <p className="text-sm text-gray-500">No plans found.</p>
          ) : (
            <div className="space-y-2">
              {plans.map((p) => (
                <div key={p.id} className="text-sm">
                  <p className="font-medium">{p.title}</p>
                  <p className="text-gray-500 capitalize">{p.status} · {new Date(p.start_date).toLocaleDateString()}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Physio */}
        <div className="rounded-lg border border-gray-200 p-5">
          <SectionHeader title="Physio" href="/follow-up/physio" />
          {cases.length === 0 ? (
            <p className="text-sm text-gray-500">No cases found.</p>
          ) : (
            <div className="space-y-2">
              {cases.map((c) => (
                <div key={c.id} className="text-sm">
                  <p className="font-medium">{c.injuries?.injury_type ?? 'Case'}</p>
                  <p className="text-gray-500 capitalize">{c.status} · {new Date(c.opened_at).toLocaleDateString()}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Psychology */}
        <div className="rounded-lg border border-gray-200 p-5">
          <SectionHeader title="Psychology" href="/follow-up/psychology" />
          {psychCases.length === 0 ? (
            <p className="text-sm text-gray-500">No cases found.</p>
          ) : (
            <div className="space-y-2">
              {psychCases.map((c) => (
                <div key={c.id} className="text-sm">
                  <p className="font-medium capitalize">{c.status} case</p>
                  <p className="text-gray-500">{new Date(c.opened_at).toLocaleDateString()}</p>
                  {c.summary && <p className="text-gray-500 truncate">{c.summary}</p>}
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </main>
  );
}
