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

const PERMISSION_TYPES = new Set([
  'instrument_use',
  'digital_reproduction',
  'official_scoring',
  'spanish_translation',
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

export async function saveInstrumentLicenseCheck(input: {
  instrumentId: string;
  permissionType: string;
  status: string;
  notes: string;
}): Promise<{ error?: string }> {
  const { user, error: accessError } = await requireMentalHealthPermission('psych.manage_instruments');
  if (!user?.profile || accessError) return { error: accessError ?? 'No autorizado.' };
  if (!LICENSE_STATUSES.has(input.status) || !PERMISSION_TYPES.has(input.permissionType)) {
    return { error: 'Estado de licenciamiento inválido.' };
  }

  const { error } = await supabaseAdmin
    .from('psych_instrument_license_checks')
    .upsert(
      {
        instrument_id: input.instrumentId,
        permission_type: input.permissionType,
        status: input.status,
        notes: input.notes.trim() || null,
        verified_by: user.profile.id,
        verified_at: new Date().toISOString(),
      },
      { onConflict: 'instrument_id,permission_type' }
    );

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
