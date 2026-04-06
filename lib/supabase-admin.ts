import { createClient } from '@supabase/supabase-js';

// This client uses the service role key and must ONLY be used in server-side code
// (Server Actions, Route Handlers, etc.) — never import this in client components.
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
