import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { getAdminAccess } from '@/lib/admin-access';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { pathname } = request.nextUrl;

  // Public routes (boleh diakses tanpa login)
  const isPublic =
    pathname.startsWith('/login') ||
    pathname === '/api/health' ||
    pathname.startsWith('/api/customer') ||
    pathname.startsWith('/api/admin/auth') ||
    pathname.startsWith('/_next') ||
    pathname === '/favicon.ico';

  const hasSupabaseConfig =
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!hasSupabaseConfig) {
    if (isPublic) return response;
    if (pathname.startsWith('/api/admin')) {
      return NextResponse.json(
        { error: 'Supabase config belum diisi di .env.local.' },
        { status: 500 }
      );
    }
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('error', 'supabase_config');
    return NextResponse.redirect(url);
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: {
          name: string;
          value: string;
          options?: Parameters<typeof response.cookies.set>[2];
        }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  const adminAccess = await getAdminAccess(user);
  const isAdmin = adminAccess.allowed;

  if (!user && !isPublic) {
    if (pathname.startsWith('/api/admin')) {
      return NextResponse.json(
        { error: 'Unauthorized - silakan login.' },
        { status: 401 }
      );
    }
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  if (user && isAdmin && pathname === '/login') {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  if (user && !isAdmin && !isPublic) {
    if (pathname.startsWith('/api/admin')) {
      return NextResponse.json(
        {
          error:
            adminAccess.source === 'internal_users'
              ? 'Forbidden - akses admin belum aktif.'
              : 'Forbidden - akun ini bukan admin.',
        },
        { status: 403 }
      );
    }
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('error', 'not_admin');
    return NextResponse.redirect(url);
  }

  if (pathname === '/') {
    const url = request.nextUrl.clone();
    url.pathname = user && isAdmin ? '/dashboard' : '/login';
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
