import { createClient } from '@supabase/supabase-js';

/**
 * Supabase admin client untuk API routes.
 * HANYA dipakai di server-side (app/api/**) — JANGAN expose ke browser.
 * Pakai service role key supaya bypass RLS untuk operasi admin.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY harus diset di .env.local'
    );
  }

  return createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
