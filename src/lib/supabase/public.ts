import "server-only";

import { createClient } from "@supabase/supabase-js";

import { getPublicEnvironment } from "@/lib/env/public";

/**
 * Cookie-free client for public projections.
 *
 * Public routes must not inherit an administrator's browser session. Doing so
 * would let RLS return drafts to a public page while the administrator is
 * signed in. This client always executes as the Supabase anonymous role.
 */
export function createPublicSupabaseClient() {
  const environment = getPublicEnvironment();

  return createClient(
    environment.NEXT_PUBLIC_SUPABASE_URL,
    environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    },
  );
}
