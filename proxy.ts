import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

// ---------------------------------------------------------------------------
// Public paths — no authentication required
// ---------------------------------------------------------------------------

/**
 * Routes that are accessible without a session.
 * Exact-match strings or prefix strings (checked with startsWith).
 */
const PUBLIC_PATHS: string[] = [
  '/login',
  // Add '/register', '/forgot-password', etc. here as needed
];

/**
 * Path prefixes that are always public regardless of auth state
 * (e.g. OAuth callbacks, webhook receivers).
 */
const PUBLIC_PREFIXES: string[] = [
  '/api/auth', // Supabase OAuth callbacks — add if you use social login
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns true only for root-relative paths that cannot be used as
 * open-redirect targets (i.e. not protocol-relative "//evil.com").
 */
function isSafeRedirectPath(path: string): boolean {
  return typeof path === 'string' && path.startsWith('/') && !path.startsWith('//');
}

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.includes(pathname)) return true;
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) return true;
  return false;
}

// ---------------------------------------------------------------------------
// Proxy (Next.js 16+ renamed middleware → proxy)
// ---------------------------------------------------------------------------

/**
 * Runs on every matched request before the page/route handler renders.
 *
 * Responsibilities
 * ────────────────
 * 1. Refresh the Supabase session token (required by @supabase/ssr).
 * 2. Gate all non-public routes behind authentication:
 *    - API routes  → 401 JSON  (not an HTML redirect)
 *    - All others  → redirect to /login?redirectTo=<current-path>
 * 3. Redirect an already-authenticated user away from /login.
 *
 * Fine-grained permission checks happen inside pages (requireAdminAccess,
 * requirePermission) and server actions (assertPermission). This proxy only
 * enforces the coarse "must be signed in" rule.
 */
export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder-anon-key',
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Must mutate both the request AND the response so the refreshed
          // token is available to the route handler.
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: use getUser(), not getSession() — getUser() re-validates the
  // JWT with the Supabase auth server, making it safe to trust in middleware.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // 1. Always allow public paths through.
  if (isPublicPath(pathname)) {
    // Redirect an already-authenticated user away from /login so they don't
    // see a login form they don't need.
    if (pathname === '/login' && user) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    return supabaseResponse;
  }

  // 2. Everything else requires authentication.
  if (!user) {
    // API routes must receive a machine-readable error, not an HTML redirect.
    if (pathname.startsWith('/api/')) {
      return new NextResponse(
        JSON.stringify({ error: 'Unauthenticated' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // For page routes, redirect to /login and preserve the intended destination
    // so the login form can redirect back after a successful sign-in.
    const loginUrl = new URL('/login', request.url);
    // pathname always starts with '/' so it is safe — no open-redirect risk
    loginUrl.searchParams.set('redirectTo', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 3. Authenticated — pass through. Role/permission checks are the
  // responsibility of the individual page or action.
  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match every path EXCEPT:
     *   _next/static   — compiled JS/CSS bundles
     *   _next/image    — image optimisation endpoint
     *   favicon.ico    — browser icon
     *   public assets  — any file with an image/font extension at the root
     */
    '/((?!_next/static|_next/image|favicon\.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)',
  ],
};
