import { redirect } from 'next/navigation';
import { requireAuthenticated } from '@/lib/rbac/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { LicenseStatusManager } from '@/components/psych/LicenseStatusManager';
import { PsychAlertsManager } from '@/components/psych/PsychAlertsManager';
import { PsychInstrumentCatalog } from '@/components/psych/PsychInstrumentCatalog';
import { PsychAssessmentList } from '@/components/psych/PsychAssessmentList';
import { SchedulePsychAssessment } from '@/components/psych/SchedulePsychAssessment';

export const dynamic = 'force-dynamic';


type LicenseStatus = 'pending_review' | 'licensed' | 'not_required' | 'denied';

export default async function MentalHealthDashboardPage() {
  const user = await requireAuthenticated();
  if (!user.profile || !user.roles.some((role) => role.code === 'mental_health_admin')) {
    redirect('/dashboard');
  }

  const { data: instrumentRows } = await supabaseAdmin
    .from('psych_instruments')
    .select('id, code, name, item_count, license_status, license_notes, is_active')
    .eq('is_test_only', false)
    .order('name');
  const instruments = (instrumentRows ?? []) as Array<{
    id: string;
    code: string;
    name: string;
    item_count: number;
    license_status: LicenseStatus;
    license_notes: string | null;
    is_active: boolean;
  }>;
  const [{ data: athleteRows }, { data: availableItemRows }, { data: licenseCheckRows }] = await Promise.all([
    supabaseAdmin.from('profiles').select('id, first_name, last_name').eq('role', 'athlete').order('last_name'),
    supabaseAdmin.from('psych_instrument_items').select('instrument_id'),
    supabaseAdmin.from('psych_instrument_license_checks').select('instrument_id, permission_type, status, notes'),
  ]);
  const itemCounts = new Map<string, number>();
  for (const row of availableItemRows ?? []) itemCounts.set(row.instrument_id as string, (itemCounts.get(row.instrument_id as string) ?? 0) + 1);
  const licenseChecksByInstrument = new Map<string, Array<{
    permissionType: 'instrument_use' | 'digital_reproduction' | 'official_scoring' | 'spanish_translation';
    status: LicenseStatus;
    notes: string;
  }>>();
  for (const row of licenseCheckRows ?? []) {
    const checks = licenseChecksByInstrument.get(row.instrument_id as string) ?? [];
    checks.push({
      permissionType: row.permission_type as 'instrument_use' | 'digital_reproduction' | 'official_scoring' | 'spanish_translation',
      status: row.status as LicenseStatus,
      notes: (row.notes as string | null) ?? '',
    });
    licenseChecksByInstrument.set(row.instrument_id as string, checks);
  }


  const { data: alertRows } = await supabaseAdmin
    .from('psych_alerts')
    .select('id, alert_type, severity, status, notes, created_at, profiles(first_name, last_name), psych_assessments!inner(psych_instruments!inner(is_test_only))')
    .eq('psych_assessments.psych_instruments.is_test_only', false)
    .order('created_at', { ascending: false });
  const alerts = (alertRows ?? []).map((rawAlert) => {
    const alert = rawAlert as {
      id: string;
      alert_type: string;
      severity: 'low' | 'medium' | 'high';
      status: 'open' | 'acknowledged' | 'resolved';
      notes: string | null;
      created_at: string;
      profiles: { first_name: string; last_name: string } | { first_name: string; last_name: string }[] | null;
    };
    const athlete = Array.isArray(alert.profiles) ? alert.profiles[0] : alert.profiles;
    return {
      id: alert.id,
      athleteName: athlete ? `${athlete.first_name} ${athlete.last_name}`.trim() : 'Atleta',
      alertType: alert.alert_type,
      severity: alert.severity,
      status: alert.status,
      notes: alert.notes ?? '',
      createdAt: alert.created_at,
    };
  });
  const { data: assessmentRows } = await supabaseAdmin
    .from('psych_assessments')
    .select('id, completed_at, published_to_athlete, profiles(first_name, last_name), psych_instruments!inner(name, is_test_only)')
    .eq('status', 'completed')
    .eq('psych_instruments.is_test_only', false)
    .order('completed_at', { ascending: false });
  const assessments = (assessmentRows ?? []).map((rawAssessment) => {
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
      published: assessment.published_to_athlete,
    };
  });

  return (
    <main className="max-w-7xl p-8">
      <header className="mb-8 border-l-4 border-[#C0172C] pl-4">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#C0172C]">Salud mental</p>
        <h1 className="mt-1 text-3xl font-bold text-[#2D2D2D]">Gestión clínica</h1>
        <p className="mt-2 max-w-3xl text-sm text-gray-600">
          Programa evaluaciones, revisa resultados y administra la disponibilidad de los instrumentos.
        </p>
      </header>
      <SchedulePsychAssessment
        athletes={(athleteRows ?? []).map((athlete) => ({ id: athlete.id as string, label: `${athlete.first_name} ${athlete.last_name}`.trim() }))}
        instruments={instruments.filter((instrument) => instrument.license_status === 'licensed' && instrument.is_active && itemCounts.get(instrument.id) === instrument.item_count).map((instrument) => ({ id: instrument.id, label: `${instrument.code} — ${instrument.name}` }))}
      />
      <PsychAssessmentList assessments={assessments} />
      <PsychInstrumentCatalog instruments={instruments.map((instrument) => ({
        id: instrument.id,
        code: instrument.code,
        name: instrument.name,
        isActive: instrument.is_active,
        licenseStatus: instrument.license_status,
      }))} />
      <PsychAlertsManager alerts={alerts} />
      <section className="mt-10">
        <div className="mb-4">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#C0172C]">Administración</p>
          <h2 className="mt-1 text-2xl font-bold text-[#2D2D2D]">Estado de licenciamiento por instrumento</h2>
          <p className="mt-1 text-sm text-gray-600">Registra evidencia para cada permiso; el estado global se deriva de las cuatro verificaciones.</p>
        </div>
        <LicenseStatusManager instruments={instruments.map((instrument) => ({
          id: instrument.id,
          code: instrument.code,
          name: instrument.name,
          licenseStatus: instrument.license_status,
          checks: licenseChecksByInstrument.get(instrument.id) ?? [],
        }))} />
      </section>
    </main>
  );
}
