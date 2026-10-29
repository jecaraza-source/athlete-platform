import 'server-only';

import { supabaseAdmin } from '@/lib/supabase-admin';

type BucketOptions = {
  public: boolean;
  fileSizeLimit?: number;
  allowedMimeTypes?: string[];
};

/**
 * Creates a storage bucket only when it is absent.
 *
 * Calling createBucket for an existing bucket makes Supabase emit a PostgreSQL
 * duplicate-key error even though the application can otherwise continue.
 */
export async function ensureStorageBucket(
  bucketId: string,
  options: BucketOptions,
): Promise<void> {
  const { data, error } = await supabaseAdmin.storage.getBucket(bucketId);

  if (data) return;
  if (error && error.statusCode !== '404') {
    throw new Error(`No se pudo consultar el bucket "${bucketId}": ${error.message}`);
  }

  const { error: createError } = await supabaseAdmin.storage.createBucket(
    bucketId,
    options,
  );

  // A concurrent first upload may create the same bucket between getBucket
  // and createBucket. Its bucket is ready to use, so the conflict is safe.
  if (createError && createError.statusCode !== '409') {
    throw new Error(`No se pudo crear el bucket "${bucketId}": ${createError.message}`);
  }
}
