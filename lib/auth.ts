import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import { getAdminAccess } from './admin-access';

/**
 * Server client untuk membaca session dari cookie.
 * Dipakai di middleware dan API route untuk cek admin yang login.
 */
export function createServerSupabaseClient() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: {
          name: string;
          value: string;
          options?: Parameters<typeof cookieStore.set>[2];
        }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server component — bisa diabaikan
          }
        },
      },
    }
  );
}

/**
 * Guard untuk API route admin. Return NextResponse 401 jika belum login.
 * Pakai di awal API handler:
 *   const guard = await requireAdmin();
 *   if (guard) return guard;
 */
export async function requireAdmin(): Promise<NextResponse | null> {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized — silakan login.' },
      { status: 401 }
    );
  }
  const access = await getAdminAccess(user);
  if (!access.allowed) {
    return NextResponse.json(
      {
        error:
          access.source === 'internal_users'
            ? 'Forbidden - akses admin belum aktif.'
            : 'Forbidden - akun ini bukan admin.',
      },
      { status: 403 }
    );
  }

  return null;
}
