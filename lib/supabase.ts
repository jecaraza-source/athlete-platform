import { createClient } from '@supabase/supabase-js';

// Fallback values prevent the client from throwing during Next.js build-time
// module evaluation. Real values must be set in your deployment environment.
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder-anon-key'
);
