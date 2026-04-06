'use server';

import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabase-admin';

const BUCKET = 'nutrition-plans';

async function ensureBucket() {
  await supabaseAdmin.storage.createBucket(BUCKET, { public: false });
  // Ignore error — bucket likely already exists
}

export async function uploadNutritionFile(planId: string, formData: FormData) {
  const file = formData.get('file') as File | null;
  if (!file || file.size === 0) {
    return { error: 'No file selected.' };
  }

  await ensureBucket();

  const ext = file.name.split('.').pop();
  const path = `${planId}/${Date.now()}.${ext}`;

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const { error: uploadError } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: file.type, upsert: true });

  if (uploadError) {
    return { error: uploadError.message };
  }

  const { error: updateError } = await supabaseAdmin
    .from('nutrition_plans')
    .update({ file_path: path })
    .eq('id', planId);

  if (updateError) {
    return { error: updateError.message };
  }

  revalidatePath('/follow-up/nutrition');
  return { error: null };
}

export async function getNutritionFileUrl(path: string): Promise<string | null> {
  const { data } = await supabaseAdmin.storage
    .from(BUCKET)
    .createSignedUrl(path, 60 * 60); // 1 hour
  return data?.signedUrl ?? null;
}
