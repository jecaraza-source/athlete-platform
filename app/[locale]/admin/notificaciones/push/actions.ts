'use server';

import { revalidatePath }      from 'next/cache';
import { z }                   from 'zod';
import { supabaseAdmin }       from '@/lib/supabase-admin';
import { assertAdminAccess, getCurrentUser } from '@/lib/rbac/server';
import { enqueuePushCampaign } from '@/lib/notifications/push-service';
import { writeNotificationAudit } from '@/lib/notifications/email-service';
import type { PushCampaign }   from '@/lib/notifications/types';

type ActionResult = { error: string | null };

const CampaignSchema = z.object({
  name:               z.string().min(1, 'El nombre es obligatorio'),
  description:        z.string().optional(),
  template_id:        z.string().uuid('Selecciona una plantilla válida'),
  selection_mode:     z.enum(['individual', 'collective']),
  audience_type:      z.enum(['athlete', 'staff', 'mixed']),
  recipient_ids:      z.array(z.string().uuid()).optional().default([]),
  audience_filters:   z.record(z.string(), z.string()).optional().default({}),
  scheduled_at:       z.string().nullable().optional(),
  timezone:           z.string().default('UTC'),
  recurrence:         z.enum(['none', 'daily', 'weekly', 'monthly', 'custom']).default('none'),
  variable_overrides: z.record(z.string(), z.string()).optional().default({}),
});

export async function createPushCampaign(formData: FormData): Promise<ActionResult & { campaignId?: string }> {
  const denied = await assertAdminAccess();
  if (denied) return denied;
  const user = await getCurrentUser();

  const parse = CampaignSchema.safeParse({
    name:             formData.get('name'),
    description:      formData.get('description') || undefined,
    template_id:      formData.get('template_id'),
    selection_mode:   formData.get('selection_mode'),
    audience_type:    formData.get('audience_type'),
    recipient_ids:    JSON.parse((formData.get('recipient_ids') as string) || '[]'),
    audience_filters: JSON.parse((formData.get('audience_filters') as string) || '{}'),
    scheduled_at:     formData.get('scheduled_at') || null,
    timezone:         formData.get('timezone') || 'UTC',
    recurrence:       formData.get('recurrence') || 'none',
    variable_overrides: JSON.parse((formData.get('variable_overrides') as string) || '{}'),
  });
  if (!parse.success) return { error: parse.error.issues[0].message };

  const d = parse.data;
  const { data: campaign, error } = await supabaseAdmin
    .from('push_campaigns')
    .insert({
      name:               d.name,
      description:        d.description ?? null,
      template_id:        d.template_id,
      selection_mode:     d.selection_mode,
      audience_type:      d.audience_type,
      recipient_ids:      d.recipient_ids,
      audience_config:    { filters: d.audience_filters },
      scheduled_at:       d.scheduled_at ?? null,
      timezone:           d.timezone,
      recurrence:         d.recurrence,
      variable_overrides: d.variable_overrides,
      status:             d.scheduled_at ? 'scheduled' : 'draft',
      created_by:         user?.profile?.id ?? null,
    })
    .select('id')
    .single();

  if (error) return { error: error.message };

  await writeNotificationAudit({
    action: 'campaign_created', performedBy: user?.profile?.id ?? null,
    entityType: 'push_campaign', entityId: campaign.id, metadata: { name: d.name },
  });

  revalidatePath('/admin/notificaciones/push');
  return { error: null, campaignId: campaign.id };
}

export async function updatePushCampaign(
  campaignId: string,
  formData:   FormData
): Promise<{ error: string | null }> {
  const denied = await assertAdminAccess();
  if (denied) return denied;
  const user = await getCurrentUser();

  const parse = CampaignSchema.safeParse({
    name:             formData.get('name'),
    description:      formData.get('description') || undefined,
    template_id:      formData.get('template_id'),
    selection_mode:   formData.get('selection_mode'),
    audience_type:    formData.get('audience_type'),
    recipient_ids:    JSON.parse((formData.get('recipient_ids') as string) || '[]'),
    audience_filters: JSON.parse((formData.get('audience_filters') as string) || '{}'),
    scheduled_at:     formData.get('scheduled_at') || null,
    timezone:         formData.get('timezone') || 'UTC',
    recurrence:       formData.get('recurrence') || 'none',
    variable_overrides: JSON.parse((formData.get('variable_overrides') as string) || '{}'),
  });
  if (!parse.success) return { error: parse.error.issues[0].message };

  const d = parse.data;
  const { error } = await supabaseAdmin
    .from('push_campaigns')
    .update({
      name:               d.name,
      description:        d.description ?? null,
      template_id:        d.template_id,
      selection_mode:     d.selection_mode,
      audience_type:      d.audience_type,
      recipient_ids:      d.recipient_ids,
      audience_config:    { filters: d.audience_filters },
      scheduled_at:       d.scheduled_at ?? null,
      timezone:           d.timezone,
      recurrence:         d.recurrence,
      variable_overrides: d.variable_overrides,
      updated_by:         user?.profile?.id ?? null,
    })
    .eq('id', campaignId);

  if (error) return { error: error.message };

  await writeNotificationAudit({
    action: 'campaign_updated', performedBy: user?.profile?.id ?? null,
    entityType: 'push_campaign', entityId: campaignId,
  });

  revalidatePath('/admin/notificaciones/push');
  revalidatePath(`/admin/notificaciones/push/${campaignId}/editar`);
  return { error: null };
}

export async function sendPushCampaign(campaignId: string): Promise<ActionResult & { enqueued?: number }> {
  const denied = await assertAdminAccess();
  if (denied) return denied;
  const user = await getCurrentUser();

  const { data: campaign } = await supabaseAdmin
    .from('push_campaigns')
    .select('*')
    .eq('id', campaignId)
    .single();
  if (!campaign) return { error: 'Campaña no encontrada.' };

  await supabaseAdmin.from('push_campaigns').update({ status: 'sending', sent_at: new Date().toISOString() }).eq('id', campaignId);
  const { enqueued, error } = await enqueuePushCampaign(campaign as PushCampaign);

  if (error) {
    await supabaseAdmin.from('push_campaigns').update({ status: 'failed' }).eq('id', campaignId);
    return { error };
  }
  await supabaseAdmin.from('push_campaigns').update({ status: 'sent' }).eq('id', campaignId);
  await writeNotificationAudit({
    action: 'campaign_sent', performedBy: user?.profile?.id ?? null,
    entityType: 'push_campaign', entityId: campaignId, metadata: { enqueued },
  });

  revalidatePath('/admin/notificaciones/push');
  return { error: null, enqueued };
}

export async function pausePushCampaign(campaignId: string): Promise<ActionResult> {
  const denied = await assertAdminAccess();
  if (denied) return denied;
  const user = await getCurrentUser();

  await supabaseAdmin.from('push_campaigns').update({ status: 'paused' }).eq('id', campaignId);
  await writeNotificationAudit({
    action: 'campaign_paused', performedBy: user?.profile?.id ?? null,
    entityType: 'push_campaign', entityId: campaignId,
  });

  revalidatePath('/admin/notificaciones/push');
  return { error: null };
}

export async function deletePushCampaign(campaignId: string): Promise<ActionResult> {
  const denied = await assertAdminAccess();
  if (denied) return denied;
  const user = await getCurrentUser();

  const { error } = await supabaseAdmin.from('push_campaigns').delete().eq('id', campaignId);
  if (error) return { error: error.message };

  await writeNotificationAudit({
    action: 'campaign_deleted', performedBy: user?.profile?.id ?? null,
    entityType: 'push_campaign', entityId: campaignId,
  });

  revalidatePath('/admin/notificaciones/push');
  return { error: null };
}

// ---------------------------------------------------------------------------
// Push templates
// ---------------------------------------------------------------------------

const PushTemplateSchema = z.object({
  name:       z.string().min(1),
  description: z.string().optional(),
  title:      z.string().min(1),
  message:    z.string().min(1),
  deep_link:  z.string().optional(),
  variables:  z.array(z.string()).optional().default([]),
  status:     z.enum(['draft', 'active', 'archived']).default('draft'),
});

export async function createPushTemplate(formData: FormData): Promise<ActionResult & { templateId?: string }> {
  const denied = await assertAdminAccess();
  if (denied) return denied;
  const user = await getCurrentUser();

  const parse = PushTemplateSchema.safeParse({
    name:        formData.get('name'),
    description: formData.get('description') || undefined,
    title:       formData.get('title'),
    message:     formData.get('message'),
    deep_link:   formData.get('deep_link') || undefined,
    variables:   JSON.parse((formData.get('variables') as string) || '[]'),
    status:      formData.get('status') || 'draft',
  });
  if (!parse.success) return { error: parse.error.issues[0].message };

  const { data: template, error } = await supabaseAdmin
    .from('push_templates')
    .insert({ ...parse.data, created_by: user?.profile?.id ?? null })
    .select('id')
    .single();
  if (error) return { error: error.message };

  await writeNotificationAudit({
    action: 'template_created', performedBy: user?.profile?.id ?? null,
    entityType: 'push_template', entityId: template.id,
  });

  revalidatePath('/admin/notificaciones/push/plantillas');
  return { error: null, templateId: template.id };
}

// ---------------------------------------------------------------------------
// Register device token (called from mobile / API)
// ---------------------------------------------------------------------------

export async function registerDeviceToken(params: {
  profileId:         string;
  onesignalPlayerId: string;
  platform:          'ios' | 'android' | 'web';
  deviceName?:       string;
}): Promise<ActionResult> {
  const { profileId, onesignalPlayerId, platform, deviceName } = params;

  const { error } = await supabaseAdmin
    .from('push_device_tokens')
    .upsert({
      profile_id:          profileId,
      onesignal_player_id: onesignalPlayerId,
      platform,
      device_name:         deviceName ?? null,
      is_active:           true,
      last_seen_at:        new Date().toISOString(),
    }, { onConflict: 'onesignal_player_id' });

  return { error: error?.message ?? null };
}
