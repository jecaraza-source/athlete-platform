import Link from 'next/link';
import BackButton from '@/components/back-button';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requirePermission } from '@/lib/rbac/server';
import { GeneralInfoSection, GuardianSection, EmergencyContactSection } from './athlete-sections';
import {
  getDisciplineLabel,
  getDisabilityLabel,
  STATUS_LABELS,
  STATUS_COLORS,
  STATUS_DOT,
  SECTION_KEYS,
  SECTION_LABELS,
  type DiagnosticStatus,
} from '@/lib/types/diagnostic';

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
  discipline: string | null;
  disability_status: string | null;
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
  await requirePermission('view_athletes');

  const { id } = await params;

  // ──────────────────────────────────────────────────────────────────────
  // 1. Query base (columnas originales — siempre presentes en la BD)
  // ──────────────────────────────────────────────────────────────────────
  const [
    { data, error },
    { data: trainingSessions },
    { data: nutritionPlans },
    { data: physioCases },
    { data: psychologyCases },
    { data: eventParticipants },
  ] = await Promise.all([
    supabaseAdmin
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
        <BackButton href="/athletes" label="Volver a Atletas" />
        <h1 className="text-2xl font-bold mt-4">Atleta no encontrado</h1>
      </main>
    );
  }

  // ──────────────────────────────────────────────────────────────────────
  // 2. Queries post-migración (silenciosas — si fallan, retornan null/[])
  // ──────────────────────────────────────────────────────────────────────
  const [{ data: extData }, { data: diagRaw }, { data: sectionsRaw }] =
    await Promise.all([
      // discipline + disability_status (añadidos en migración 011)
      supabaseAdmin
        .from('athletes')
        .select('id, discipline, disability_status')
        .eq('id', id)
        .maybeSingle(),
      // diagnóstico inicial
      supabaseAdmin
        .from('athlete_initial_diagnostic')
        .select('overall_status, completion_pct')
        .eq('athlete_id', id)
        .maybeSingle(),
      // secciones por rubro
      supabaseAdmin
        .from('athlete_diagnostic_sections')
        .select('section, status')
        .eq('athlete_id', id),
    ]);

  const athlete: AthleteDetail = {
    ...(data as Omit<AthleteDetail, 'discipline' | 'disability_status'>),
    discipline:        (extData as Record<string, string> | null)?.discipline        ?? null,
    disability_status: (extData as Record<string, string> | null)?.disability_status ?? null,
  };
  const diagnostic = diagRaw as { overall_status: string; completion_pct: number } | null;
  const sections   = sectionsRaw as { section: string; status: string }[] | null;

  const sessions   = (trainingSessions ?? []) as { id: string; title: string; session_date: string; location: string | null }[];
  const plans      = (nutritionPlans ?? []) as { id: string; title: string; start_date: string; end_date: string | null; status: string }[];
  const cases      = (physioCases ?? []) as unknown as { id: string; status: string; opened_at: string; injuries: { injury_type: string } | null }[];
  const psychCases = (psychologyCases ?? []) as unknown as { id: string; status: string; opened_at: string; summary: string | null }[];
  const events     = (eventParticipants ?? []) as unknown as { id: string; notes: string | null; events: { id: string; title: string; event_type: string; start_at: string; status: string } | null }[];

  const diagStatus   = (diagnostic?.overall_status as DiagnosticStatus) ?? 'pendiente';
  const diagPct      = diagnostic?.completion_pct ?? 0;
  const diagComplete = diagStatus === 'completo';
  const sectionMap = Object.fromEntries(
    (sections ?? []).map((s) => [s.section, s.status as DiagnosticStatus])
  ) as Partial<Record<string, DiagnosticStatus>>;

  return (
    <main className="p-8">
      <BackButton href="/athletes" label="Volver a Atletas" />

      {/* Banner de diagnóstico inicial pendiente */}
      {!diagComplete && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${STATUS_DOT[diagStatus]}`} />
            <p className="text-sm text-amber-800">
              <strong>Diagnóstico inicial:</strong>{' '}
              {STATUS_LABELS[diagStatus]}{diagPct > 0 ? ` (${diagPct}%)` : ''}
              {diagStatus === 'pendiente' && ' — El expediente diagnóstico no ha sido iniciado.'}
            </p>
          </div>
          <Link
            href={`/athletes/${id}/diagnostic`}
            className="text-xs font-medium text-amber-700 underline underline-offset-2 hover:text-amber-900 whitespace-nowrap"
          >
            Ir al diagnóstico inicial →
          </Link>
        </div>
      )}

      {/* Header */}
      <div className="mt-4 flex flex-col md:flex-row md:items-start md:justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-emerald-700">
            {athlete.first_name} {athlete.last_name}
          </h1>
          {athlete.athlete_code && (
            <p className="text-sm text-gray-500 mt-0.5">Código: {athlete.athlete_code}</p>
          )}
          <div className="flex flex-wrap gap-3 mt-1 text-sm text-gray-500">
            <span>Disciplina: <strong className="text-gray-700">{getDisciplineLabel(athlete.discipline)}</strong></span>
            {athlete.disability_status && (
              <span>· {getDisabilityLabel(athlete.disability_status)}</span>
            )}
          </div>
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

      {/* Diagnóstico Inicial — resumen semáforo */}
      <div className="mt-8 rounded-lg border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-base">Diagnóstico Inicial Integral</h2>
          <Link href={`/athletes/${id}/diagnostic`} className="text-xs text-blue-600 hover:underline">
            Ver completo →
          </Link>
        </div>
        <div className="mb-3">
          <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
            <span>Avance total</span>
            <span className="font-semibold text-emerald-700">{diagPct}%</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${
                diagComplete ? 'bg-green-500' : diagPct > 0 ? 'bg-emerald-500' : 'bg-gray-300'
              }`}
              style={{ width: `${diagPct}%` }}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {SECTION_KEYS.map((section) => {
            const st: DiagnosticStatus = (sectionMap[section] ?? 'pendiente') as DiagnosticStatus;
            return (
              <div key={section} className={`flex flex-col items-center gap-1 p-2 rounded-md border text-center ${STATUS_COLORS[st]}`}>
                <span className={`w-2.5 h-2.5 rounded-full ${STATUS_DOT[st]}`} />
                <span className="text-xs font-medium">{SECTION_LABELS[section]}</span>
                <span className="text-xs">{STATUS_LABELS[st]}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Follow-up */}
      <h2 className="text-xl font-bold mt-8 mb-4">Seguimiento</h2>
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
