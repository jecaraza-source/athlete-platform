'use server';

import { revalidatePath }   from 'next/cache';
import { z }                from 'zod';
import { supabaseAdmin }    from '@/lib/supabase-admin';
import { assertAdminAccess, getCurrentUser } from '@/lib/rbac/server';
import { writeNotificationAudit } from '@/lib/notifications/email-service';

const Schema = z.object({
  name:        z.string().min(1),
  description: z.string().optional(),
  title:       z.string().min(1),
  message:     z.string().min(1),
  deep_link:   z.string().optional(),
  variables:   z.array(z.string()).optional().default([]),
  status:      z.enum(['draft', 'active', 'archived']).default('draft'),
});

export async function updatePushTemplate(
  templateId: string,
  formData:   FormData
): Promise<{ error: string | null }> {
  const denied = await assertAdminAccess();
  if (denied) return denied;
  const user = await getCurrentUser();

  const parse = Schema.safeParse({
    name:        formData.get('name'),
    description: formData.get('description') || undefined,
    title:       formData.get('title'),
    message:     formData.get('message'),
    deep_link:   formData.get('deep_link') || undefined,
    variables:   JSON.parse((formData.get('variables') as string) || '[]'),
    status:      formData.get('status') || 'draft',
  });

  if (!parse.success) return { error: parse.error.issues[0].message };

  // Bump version on save
  const { data: current } = await supabaseAdmin
    .from('push_templates')
    .select('version')
    .eq('id', templateId)
    .single();

  const { error } = await supabaseAdmin
    .from('push_templates')
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
    entityType:  'push_template',
    entityId:    templateId,
  });

  revalidatePath('/admin/notificaciones/push/plantillas');
  return { error: null };
}
