'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/rbac/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

const LICENSE_STATUSES = new Set([
  'pending_review',
  'licensed',
  'not_required',
  'denied',
]);

async function requireMentalHealthPermission(permission: string) {
  const user = await getCurrentUser();
  if (!user?.profile) return { user: null, error: 'No autenticado.' };
  if (
    !user.roles.some((role) => role.code === 'mental_health_admin') ||
    !user.permissions.has(permission)
  ) {
    return { user: null, error: 'No tienes acceso para realizar esta operación.' };
  }
  return { user, error: null };
}

export async function schedulePsychAssessment(input: { athleteId: string; instrumentId: string; scheduledFor: string }): Promise<{ error?: string }> {
  const { user, error: accessError } = await requireMentalHealthPermission('psych.schedule_assessments');
  if (!user?.profile || accessError) return { error: accessError ?? 'No autorizado.' };
  const date = new Date(input.scheduledFor);
  if (!input.athleteId || !input.instrumentId || Number.isNaN(date.getTime())) return { error: 'Selecciona atleta, examen y fecha válidos.' };
  const [{ data: athlete }, { data: instrument }] = await Promise.all([
    supabaseAdmin.from('profiles').select('id, first_name, email').eq('id', input.athleteId).maybeSingle(),
    supabaseAdmin.from('psych_instruments').select('id, name, item_count').eq('id', input.instrumentId).eq('is_active', true).in('license_status', ['licensed', 'not_required']).maybeSingle(),
  ]);
  if (!athlete || !instrument) return { error: 'Atleta o instrumento no disponible.' };
  const { count } = await supabaseAdmin.from('psych_instrument_items').select('id', { count: 'exact', head: true }).eq('instrument_id', instrument.id);
  if (count !== instrument.item_count) return { error: 'El instrumento no tiene todos sus reactivos cargados.' };
  const { data: assessment, error } = await supabaseAdmin.from('psych_assessments').insert({ athlete_id: athlete.id, instrument_id: instrument.id, scheduled_for: date.toISOString(), context: 'scheduled' }).select('id').single();
  if (error || !assessment) return { error: error?.message ?? 'No fue posible programar la evaluación.' };
  const key = `psych-assessment:${assessment.id}`;
  await supabaseAdmin.from('email_jobs').insert({ recipient_profile_id: athlete.id, recipient_email: athlete.email, subject: 'Tienes una evaluación psicológica pendiente', html_body: `<p>Hola ${athlete.first_name},</p><p>Tienes pendiente la evaluación <strong>${instrument.name}</strong>.</p>`, plain_body: `Tienes pendiente la evaluación ${instrument.name}.`, idempotency_key: `${key}:email`, scheduled_at: new Date().toISOString() });
  const { data: tokens } = await supabaseAdmin.from('push_device_tokens').select('id, onesignal_player_id, device_token').eq('profile_id', athlete.id).eq('is_active', true);
  if (tokens?.length) await supabaseAdmin.from('push_jobs').insert(tokens.map((token) => ({ recipient_profile_id: athlete.id, device_token_id: token.id, onesignal_player_id: token.onesignal_player_id ?? token.device_token, title: 'Evaluación pendiente', message: `Tienes pendiente ${instrument.name}.`, deep_link: '/dashboard/psych', extra_data: { assessmentId: assessment.id }, idempotency_key: `${key}:push:${token.id}`, scheduled_at: new Date().toISOString() })));
  revalidatePath('/dashboard/mental-health');
  return {};
}

export async function savePsychInstrumentLicense(input: {
  instrumentId: string;
  status: string;
  notes: string;
}): Promise<{ error?: string }> {
  const { user, error: accessError } = await requireMentalHealthPermission('psych.manage_instruments');
  if (!user?.profile || accessError) return { error: accessError ?? 'No autorizado.' };
  if (!LICENSE_STATUSES.has(input.status)) {
    return { error: 'Estado de licenciamiento inválido.' };
  }

  const { error } = await supabaseAdmin
    .from('psych_instruments')
    .update({
      license_status: input.status,
      license_notes: input.notes.trim() || null,
      license_verified_by: input.status === 'licensed' ? user.profile.id : null,
      license_verified_at: input.status === 'licensed' ? new Date().toISOString() : null,
    })
    .eq('id', input.instrumentId)
    .eq('is_test_only', false);
  if (error) return { error: error.message };
  revalidatePath('/dashboard/mental-health');
  return {};
}

export async function updatePsychAlert(input: {
  alertId: string;
  status: 'acknowledged' | 'resolved';
  notes: string;
}): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!user?.profile) return { error: 'No autenticado.' };
  if (
    !user.roles.some((role) => ['mental_health_admin', 'program_director'].includes(role.code)) ||
    !user.permissions.has('psych.manage_alerts')
  ) {
    return { error: 'No tienes acceso para actualizar alertas.' };
  }

  const { data: alert } = await supabaseAdmin
    .from('psych_alerts')
    .select('id, psych_assessments!inner(psych_instruments!inner(is_test_only))')
    .eq('id', input.alertId)
    .eq('psych_assessments.psych_instruments.is_test_only', false)
    .maybeSingle();
  if (!alert) return { error: 'Alerta no encontrada.' };

  const now = new Date().toISOString();
  const { error } = await supabaseAdmin
    .from('psych_alerts')
    .update({
      status: input.status,
      notes: input.notes.trim() || null,
      acknowledged_by: user.profile.id,
      resolved_at: input.status === 'resolved' ? now : null,
    })
    .eq('id', input.alertId);
  if (error) return { error: error.message };

  revalidatePath('/dashboard/mental-health');
  return {};
}

export async function setPsychInstrumentActive(input: {
  instrumentId: string;
  isActive: boolean;
}): Promise<{ error?: string }> {
  const { user, error: accessError } = await requireMentalHealthPermission('psych.manage_instruments');
  if (!user?.profile || accessError) return { error: accessError ?? 'No autorizado.' };

  const { data: instrument } = await supabaseAdmin
    .from('psych_instruments')
    .select('id, is_test_only')
    .eq('id', input.instrumentId)
    .eq('is_test_only', false)
    .maybeSingle();
  if (!instrument) return { error: 'Instrumento no encontrado.' };

  const { error } = await supabaseAdmin
    .from('psych_instruments')
    .update({ is_active: input.isActive })
    .eq('id', input.instrumentId);
  if (error) return { error: error.message };

  revalidatePath('/dashboard/mental-health');
  return {};
}

export async function savePsychScoreInterpretation(input: {
  scoreId: string;
  interpretationText: string;
}): Promise<{ error?: string }> {
  const { user, error: accessError } = await requireMentalHealthPermission('psych.write_interpretation');
  if (!user?.profile || accessError) return { error: accessError ?? 'No autorizado.' };

  const { data: score } = await supabaseAdmin
    .from('psych_scores')
    .select('id, psych_assessments!inner(psych_instruments!inner(is_test_only))')
    .eq('id', input.scoreId)
    .eq('psych_assessments.psych_instruments.is_test_only', false)
    .maybeSingle();
  if (!score) return { error: 'Puntaje no encontrado.' };

  const { error } = await supabaseAdmin
    .from('psych_scores')
    .update({ interpretation_text: input.interpretationText.trim() || null })
    .eq('id', input.scoreId);
  if (error) return { error: error.message };

  revalidatePath('/dashboard/mental-health');
  return {};
}
