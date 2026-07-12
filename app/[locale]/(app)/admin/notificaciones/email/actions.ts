'use server';

import { revalidatePath }         from 'next/cache';
import { z }                      from 'zod';
import { supabaseAdmin }          from '@/lib/supabase-admin';
import { assertAdminAccess, getCurrentUser } from '@/lib/rbac/server';
import { enqueueEmailCampaign, writeNotificationAudit } from '@/lib/notifications/email-service';
import { sendEmailDirect }        from '@/lib/notifications/email-service';
import { renderEmailTemplate }    from '@/lib/notifications/template-utils';
import type { EmailCampaign }     from '@/lib/notifications/types';

type ActionResult = { error: string | null };

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Create campaign
// ---------------------------------------------------------------------------

export async function createEmailCampaign(formData: FormData): Promise<ActionResult & { campaignId?: string }> {
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

  if (!parse.success) {
    return { error: parse.error.issues[0].message };
  }

  const d = parse.data;

  const { data: campaign, error } = await supabaseAdmin
    .from('email_campaigns')
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
    action:      'campaign_created',
    performedBy: user?.profile?.id ?? null,
    entityType:  'email_campaign',
    entityId:    campaign.id,
    metadata:    { name: d.name },
  });

  revalidatePath('/admin/notificaciones/email');
  return { error: null, campaignId: campaign.id };
}

// ---------------------------------------------------------------------------
// Update campaign
// ---------------------------------------------------------------------------

export async function updateEmailCampaign(
  campaignId: string,
  formData:   FormData
): Promise<ActionResult> {
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
    .from('email_campaigns')
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
    action:      'campaign_updated',
    performedBy: user?.profile?.id ?? null,
    entityType:  'email_campaign',
    entityId:    campaignId,
  });

  revalidatePath('/admin/notificaciones/email');
  revalidatePath(`/admin/notificaciones/email/${campaignId}`);
  return { error: null };
}

// ---------------------------------------------------------------------------
// Send campaign (enqueue jobs)
// ---------------------------------------------------------------------------

export async function sendEmailCampaign(campaignId: string): Promise<ActionResult & { enqueued?: number }> {
  const denied = await assertAdminAccess();
  if (denied) return denied;

  const user = await getCurrentUser();

  const { data: campaign } = await supabaseAdmin
    .from('email_campaigns')
    .select('*')
    .eq('id', campaignId)
    .single();

  if (!campaign) return { error: 'Campaña no encontrada.' };

  // Update status to sending
  await supabaseAdmin
    .from('email_campaigns')
    .update({ status: 'sending', sent_at: new Date().toISOString() })
    .eq('id', campaignId);

  const { enqueued, error } = await enqueueEmailCampaign(campaign as EmailCampaign);

  if (error) {
    await supabaseAdmin
      .from('email_campaigns')
      .update({ status: 'failed' })
      .eq('id', campaignId);
    return { error };
  }

  await supabaseAdmin
    .from('email_campaigns')
    .update({ status: 'sent' })
    .eq('id', campaignId);

  await writeNotificationAudit({
    action:      'campaign_sent',
    performedBy: user?.profile?.id ?? null,
    entityType:  'email_campaign',
    entityId:    campaignId,
    metadata:    { enqueued },
  });

  revalidatePath('/admin/notificaciones/email');
  return { error: null, enqueued };
}

// ---------------------------------------------------------------------------
// Pause campaign
// ---------------------------------------------------------------------------

export async function pauseEmailCampaign(campaignId: string): Promise<ActionResult> {
  const denied = await assertAdminAccess();
  if (denied) return denied;

  const user = await getCurrentUser();

  await supabaseAdmin
    .from('email_campaigns')
    .update({ status: 'paused' })
    .eq('id', campaignId);

  await writeNotificationAudit({
    action:      'campaign_paused',
    performedBy: user?.profile?.id ?? null,
    entityType:  'email_campaign',
    entityId:    campaignId,
  });

  revalidatePath('/admin/notificaciones/email');
  return { error: null };
}

// ---------------------------------------------------------------------------
// Delete campaign
// ---------------------------------------------------------------------------

export async function deleteEmailCampaign(campaignId: string): Promise<ActionResult> {
  const denied = await assertAdminAccess();
  if (denied) return denied;

  const user = await getCurrentUser();

  const { error } = await supabaseAdmin
    .from('email_campaigns')
    .delete()
    .eq('id', campaignId);

  if (error) return { error: error.message };

  await writeNotificationAudit({
    action:      'campaign_deleted',
    performedBy: user?.profile?.id ?? null,
    entityType:  'email_campaign',
    entityId:    campaignId,
  });

  revalidatePath('/admin/notificaciones/email');
  return { error: null };
}

// ---------------------------------------------------------------------------
// Template actions
// ---------------------------------------------------------------------------

const TemplateSchema = z.object({
  name:       z.string().min(1),
  description: z.string().optional(),
  subject:    z.string().min(1),
  html_body:  z.string().min(1),
  plain_body: z.string().default(''),
  variables:  z.array(z.string()).optional().default([]),
  status:     z.enum(['draft', 'active', 'archived']).default('draft'),
});

export async function createEmailTemplate(formData: FormData): Promise<ActionResult & { templateId?: string }> {
  const denied = await assertAdminAccess();
  if (denied) return denied;

  const user = await getCurrentUser();

  const parse = TemplateSchema.safeParse({
    name:        formData.get('name'),
    description: formData.get('description') || undefined,
    subject:     formData.get('subject'),
    html_body:   formData.get('html_body'),
    plain_body:  formData.get('plain_body') || '',
    variables:   JSON.parse((formData.get('variables') as string) || '[]'),
    status:      formData.get('status') || 'draft',
  });

  if (!parse.success) return { error: parse.error.issues[0].message };

  const d = parse.data;

  const { data: template, error } = await supabaseAdmin
    .from('email_templates')
    .insert({ ...d, created_by: user?.profile?.id ?? null })
    .select('id')
    .single();

  if (error) return { error: error.message };

  await writeNotificationAudit({
    action:      'template_created',
    performedBy: user?.profile?.id ?? null,
    entityType:  'email_template',
    entityId:    template.id,
  });

  revalidatePath('/admin/notificaciones/email/plantillas');
  return { error: null, templateId: template.id };
}

export async function updateEmailTemplate(
  templateId: string,
  formData:   FormData
): Promise<ActionResult> {
  const denied = await assertAdminAccess();
  if (denied) return denied;

  const user = await getCurrentUser();

  const parse = TemplateSchema.safeParse({
    name:        formData.get('name'),
    description: formData.get('description') || undefined,
    subject:     formData.get('subject'),
    html_body:   formData.get('html_body'),
    plain_body:  formData.get('plain_body') || '',
    variables:   JSON.parse((formData.get('variables') as string) || '[]'),
    status:      formData.get('status') || 'draft',
  });

  if (!parse.success) return { error: parse.error.issues[0].message };

  // Bump version
  const { data: current } = await supabaseAdmin
    .from('email_templates')
    .select('version')
    .eq('id', templateId)
    .single();

  const { error } = await supabaseAdmin
    .from('email_templates')
    .update({
      ...parse.data,
      version:    (current?.version ?? 1) + 1,
      updated_by: user?.profile?.id ?? null,
    })
    .eq('id', templateId);

  if (error) return { error: error.message };

  await writeNotificationAudit({
    action:      'template_updated',
    performedBy: user?.profile?.id ?? null,
    entityType:  'email_template',
    entityId:    templateId,
  });

  revalidatePath('/admin/notificaciones/email/plantillas');
  return { error: null };
}

// ---------------------------------------------------------------------------
// Test send
// ---------------------------------------------------------------------------

export async function sendTestEmail(params: {
  templateId: string;
  toEmail:    string;
  variables:  Record<string, string>;
}): Promise<ActionResult> {
  const denied = await assertAdminAccess();
  if (denied) return denied;

  const { data: template } = await supabaseAdmin
    .from('email_templates')
    .select('*')
    .eq('id', params.templateId)
    .single();

  if (!template) return { error: 'Plantilla no encontrada.' };

  const { html, text, subject } = renderEmailTemplate(
    template.html_body,
    template.plain_body,
    template.subject,
    params.variables
  );

  const { error } = await sendEmailDirect({ to: params.toEmail, subject, html, text });
  return { error };
}
