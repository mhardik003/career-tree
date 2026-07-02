import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Server-side Supabase client (service role — bypasses RLS).
 * Never import this from client components; the key must stay on the server.
 *
 * Lazily initialized so a missing env var fails the request that needs it,
 * not the whole build/module load.
 */
let cached: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (cached) return cached;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      'Please define SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY inside .env.local'
    );
  }

  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return cached;
}
