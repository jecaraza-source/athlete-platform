import { createBrowserClient } from '@supabase/ssr';

/**
 * Creates a Supabase browser client for use in Client Components.
 * Uses @supabase/ssr (the project standard) instead of the deprecated
 * @supabase/auth-helpers-nextjs package.
 */
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder-anon-key'
  );
}
