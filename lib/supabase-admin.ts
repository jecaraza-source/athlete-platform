import 'server-only';
import { createClient } from '@supabase/supabase-js';

// This client uses the service role key and must ONLY be used in server-side code
// (Server Actions, Route Handlers, etc.) — never import this in client components.
// The "server-only" import above causes a build-time error if this module is
// accidentally imported in a Client Component bundle.
// Fallback values prevent the client from throwing during Next.js build-time
// module evaluation. Real values must be set in your deployment environment.
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'placeholder-service-role-key'
);
