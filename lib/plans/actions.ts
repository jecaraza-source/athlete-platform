'use server';

import { randomUUID }    from 'crypto';
import { revalidatePath } from 'next/cache';
import { supabaseAdmin }  from '@/lib/supabase-admin';
import { assertAdminAccess, getCurrentUser } from '@/lib/rbac/server';
import { sendEmailDirect } from '@/lib/notifications/email-service';

// =============================================================================
// Types
// =============================================================================

export type PlanType =
  | 'medical'
  | 'nutrition'
  | 'psychology'
  | 'training'
  | 'rehabilitation';

export type AthleteSummary = {
  id:         string;
  first_name: string;
  last_name:  string;
  email:      string | null;
  status:     string;
};

export type AthletePlanRow = {
  athlete_id:      string;
  assignment_mode: string;
  athletes: {
    first_name: string;
    last_name:  string;
  } | null;
};

export type Plan = {
  id:            string;
  type:          PlanType;
  title:         string;
  description:   string | null;
  notes:         string | null;
  file_path:     string | null;
  file_name:     string | null;
  file_size:     number | null;
  is_published:  boolean;
  uploaded_by:   string | null;
  created_at:    string;
  updated_at:    string;
  athlete_plans: AthletePlanRow[];
};

const BUCKET   = 'plans';
const MAX_SIZE = 50 * 1024 * 1024; // 50 MB

async function ensureBucket(): Promise<void> {
  await supabaseAdmin.storage.createBucket(BUCKET, {
    public:           false,
    fileSizeLimit:    MAX_SIZE,
    allowedMimeTypes: ['application/pdf'],
  });
  // Ignore the error — it means the bucket already exists.
}

// =============================================================================
// Queries
// =============================================================================

/** Returns all plans for a given type, newest first, with athlete assignments. */
export async function getPlansByType(type: PlanType): Promise<Plan[]> {
  const { data, error } = await supabaseAdmin
    .from('plans')
    .select(`
      *,
      athlete_plans (
        athlete_id,
        assignment_mode,
        athletes ( first_name, last_name )
      )
    `)
    .eq('type', type)
    .order('created_at', { ascending: false });

  if (error) {
    const isMissing =
      error.message?.includes('plans') ||
      error.message?.includes('schema cache');
    if (!isMissing) console.error('[plans] getPlansByType:', error.message);
    return [];
  }
  return (data ?? []) as Plan[];
}

/** Creates a signed URL (valid 1 hour) for a plan PDF. */
export async function getPlanSignedUrl(filePath: string): Promise<string | null> {
  if (!filePath) return null;
  const { data } = await supabaseAdmin.storage
    .from(BUCKET)
    .createSignedUrl(filePath, 60 * 60);
  return data?.signedUrl ?? null;
}

/** Returns all active athletes for the assignment picker. */
export async function getActiveAthletes(): Promise<AthleteSummary[]> {
  const { data, error } = await supabaseAdmin
    .from('athletes')
    .select('id, first_name, last_name, email, status')
    .eq('status', 'active')
    .order('last_name');

  if (error) return [];
  return (data ?? []) as AthleteSummary[];
}

// =============================================================================
// Mutations
// =============================================================================

/**
 * Creates a new plan, optionally uploads a PDF, assigns athletes, and
 * optionally sends email/push notifications to the assigned athletes.
 */
export async function createPlan(
  type: PlanType,
  formData: FormData
): Promise<{ error: string | null; planId: string | null }> {
  const denied = await assertAdminAccess();
  if (denied) return { ...denied, planId: null };

  const currentUser = await getCurrentUser();

  // ── Validate required fields ─────────────────────────────────────────────
  const title = (formData.get('title') as string | null)?.trim();
  if (!title) return { error: 'El título es requerido.', planId: null };

  const description     = (formData.get('description')      as string | null)?.trim() || null;
  const notes           = (formData.get('notes')            as string | null)?.trim() || null;
  const isPublished     = formData.get('is_published')     === 'true';
  const assignmentMode  = (formData.get('assignment_mode')  as string) || 'individual';
  const athleteIds      = (formData.getAll('athlete_ids')  as string[]).filter(Boolean);
  const notifyEmail     = formData.get('notify_email')     === 'true';
  const notifyPush      = formData.get('notify_push')      === 'true';

  // ── Optional PDF upload ───────────────────────────────────────────────────
  const file = formData.get('file') as File | null;
  let filePath: string | null = null;
  let fileName: string | null = null;
  let fileSize: number | null = null;

  if (file && file.size > 0) {
    if (file.type !== 'application/pdf') {
      return { error: 'Solo se permiten archivos PDF.', planId: null };
    }
    if (file.size > MAX_SIZE) {
      return { error: `El archivo excede el límite de 50 MB (${(file.size / 1024 / 1024).toFixed(1)} MB).`, planId: null };
    }

    await ensureBucket();

    filePath = `${type}/${randomUUID()}.pdf`;
    fileName = file.name;
    fileSize = file.size;

    const buffer          = Buffer.from(await file.arrayBuffer());
    const { error: upErr } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(filePath, buffer, { contentType: 'application/pdf', upsert: false });

    if (upErr) return { error: upErr.message, planId: null };
  }

  // ── Insert plan row ───────────────────────────────────────────────────────
  const { data: plan, error: dbErr } = await supabaseAdmin
    .from('plans')
    .insert({
      type,
      title,
      description,
      notes,
      file_path:    filePath,
      file_name:    fileName,
      file_size:    fileSize,
      is_published: isPublished,
      uploaded_by:  currentUser?.profile?.id ?? null,
      updated_at:   new Date().toISOString(),
    })
    .select('id')
    .single();

  if (dbErr || !plan) {
    // Rollback: remove the just-uploaded file if any
    if (filePath) await supabaseAdmin.storage.from(BUCKET).remove([filePath]);
    return { error: dbErr?.message ?? 'Error al crear el plan.', planId: null };
  }

  const planId = plan.id as string;

  // ── Resolve final athlete list ────────────────────────────────────────────
  let resolvedIds = athleteIds;
  if (assignmentMode === 'collective') {
    const { data: allAthletes } = await supabaseAdmin
      .from('athletes')
      .select('id')
      .eq('status', 'active');
    resolvedIds = (allAthletes ?? []).map((a: { id: string }) => a.id);
  }

  // ── Assign athletes ───────────────────────────────────────────────────────
  if (resolvedIds.length > 0) {
    const rows = resolvedIds.map((id) => ({
      plan_id:         planId,
      athlete_id:      id,
      assignment_mode: assignmentMode,
    }));
    await supabaseAdmin
      .from('athlete_plans')
      .upsert(rows, { onConflict: 'plan_id, athlete_id', ignoreDuplicates: true });
  }

  // ── Notifications ─────────────────────────────────────────────────────────
  if ((notifyEmail || notifyPush) && resolvedIds.length > 0) {
    await notifyAthletesAboutPlan({
      planId,
      title,
      type,
      athleteIds: resolvedIds,
      notifyEmail,
      notifyPush,
    });
  }

  revalidatePath(`/plans/${type}`);
  return { error: null, planId };
}

/** Permanently deletes a plan (file + DB row, cascades athlete_plans). */
export async function deletePlan(
  id:       string,
  filePath: string | null
): Promise<{ error: string | null }> {
  const denied = await assertAdminAccess();
  if (denied) return denied;

  if (filePath) {
    await supabaseAdmin.storage.from(BUCKET).remove([filePath]);
  }

  const { error } = await supabaseAdmin.from('plans').delete().eq('id', id);
  if (error) return { error: error.message };

  revalidatePath('/plans', 'layout');
  return { error: null };
}

/** Toggles the is_published flag on a plan. */
export async function togglePlanPublished(
  id:          string,
  isPublished: boolean
): Promise<{ error: string | null }> {
  const denied = await assertAdminAccess();
  if (denied) return denied;

  const { error } = await supabaseAdmin
    .from('plans')
    .update({ is_published: isPublished, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) return { error: error.message };

  revalidatePath('/plans', 'layout');
  return { error: null };
}

// =============================================================================
// Internal: notification helper
// =============================================================================

const TYPE_LABELS: Record<PlanType, string> = {
  medical:        'Plan Médico',
  nutrition:      'Plan Alimentario',
  psychology:     'Plan Psicológico',
  training:       'Plan de Entrenamiento',
  rehabilitation: 'Plan de Rehabilitación',
};

async function notifyAthletesAboutPlan(params: {
  planId:      string;
  title:       string;
  type:        PlanType;
  athleteIds:  string[];
  notifyEmail: boolean;
  notifyPush:  boolean;
}): Promise<void> {
  const typeLabel = TYPE_LABELS[params.type];

  // Fetch athlete email + linked profile id in one query
  const { data: athletes } = await supabaseAdmin
    .from('athletes')
    .select('id, first_name, last_name, email, profile_id')
    .in('id', params.athleteIds);

  for (const athlete of (athletes ?? []) as {
    id:         string;
    first_name: string;
    last_name:  string;
    email:      string | null;
    profile_id: string | null;
  }[]) {
    const firstName = athlete.first_name ?? 'Atleta';

    // ── Email ───────────────────────────────────────────────────────────────
    if (params.notifyEmail && athlete.email) {
      const html = `
        <div style="font-family:sans-serif;max-width:560px;margin:auto">
          <h2 style="color:#4f46e5">Nuevo ${typeLabel}</h2>
          <p>Hola <strong>${firstName}</strong>,</p>
          <p>
            Se ha publicado un nuevo <strong>${typeLabel}</strong> para ti:
            <strong>${params.title}</strong>.
          </p>
          <p>Puedes consultarlo en la aplicación móvil de <strong>AO Deportes</strong>.</p>
          <p style="color:#6b7280;font-size:0.875rem">Equipo AO Deportes</p>
        </div>
      `;
      const text =
        `Hola ${firstName},\n\nSe ha publicado un nuevo ${typeLabel}: ${params.title}.\n` +
        `Puedes consultarlo en la app móvil de AO Deportes.\n\nEquipo AO Deportes`;

      await sendEmailDirect({
        to:      athlete.email,
        subject: `Nuevo ${typeLabel}: ${params.title}`,
        html,
        text,
      }).catch((e) => console.error('[plans] sendEmailDirect:', e));
    }

    // ── Push ────────────────────────────────────────────────────────────────
    if (params.notifyPush && athlete.profile_id) {
      const { data: tokens } = await supabaseAdmin
        .from('push_device_tokens')
        .select('id, onesignal_player_id, device_token')
        .eq('profile_id', athlete.profile_id)
        .eq('is_active', true)
        .or('onesignal_player_id.not.is.null,device_token.not.is.null');

      if (!tokens || tokens.length === 0) continue;

      const pushRows = (tokens as {
        id:                  string;
        onesignal_player_id: string | null;
        device_token:        string | null;
      }[])
        .map((tok) => {
          const effectiveToken = tok.onesignal_player_id ?? tok.device_token;
          if (!effectiveToken) return null;
          return {
            campaign_id:          null,
            template_id:          null,
            recipient_profile_id: athlete.profile_id!,
            device_token_id:      tok.id,
            onesignal_player_id:  effectiveToken,
            title:                `Nuevo ${typeLabel}`,
            message:              params.title,
            deep_link:            '/app/(tabs)/index',
            extra_data:           { plan_id: params.planId, plan_type: params.type },
            status:               'pending' as const,
            idempotency_key:
              `plan:${params.planId}:profile:${athlete.profile_id}:token:${tok.id}`,
            scheduled_at: new Date().toISOString(),
          };
        })
        .filter((r): r is NonNullable<typeof r> => r !== null);

      if (pushRows.length > 0) {
        await supabaseAdmin
          .from('push_jobs')
          .upsert(pushRows, { onConflict: 'idempotency_key', ignoreDuplicates: true });
      }
    }
  }
}
