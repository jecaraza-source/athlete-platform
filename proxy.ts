import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

// ---------------------------------------------------------------------------
// Locale configuration
// ---------------------------------------------------------------------------

const LOCALES = ['en', 'es'] as const;
type Locale = (typeof LOCALES)[number];
const DEFAULT_LOCALE: Locale = 'en';

function getLocaleFromPath(pathname: string): Locale | null {
  for (const locale of LOCALES) {
    if (pathname === `/${locale}` || pathname.startsWith(`/${locale}/`)) {
      return locale;
    }
  }
  return null;
}

function stripLocale(pathname: string): string {
  for (const locale of LOCALES) {
    if (pathname === `/${locale}` || pathname.startsWith(`/${locale}/`)) {
      return pathname.slice(locale.length + 1) || '/';
    }
  }
  return pathname;
}

function detectLocale(request: NextRequest): Locale {
  // 1. Check NEXT_LOCALE cookie (set when user manually switches language)
  const cookieLocale = request.cookies.get('NEXT_LOCALE')?.value;
  if (cookieLocale && LOCALES.includes(cookieLocale as Locale)) {
    return cookieLocale as Locale;
  }
  // 2. Check Accept-Language header
  const acceptLang = request.headers.get('Accept-Language') ?? '';
  for (const part of acceptLang.split(',')) {
    const lang = part.split(';')[0].trim().toLowerCase().slice(0, 2) as Locale;
    if (LOCALES.includes(lang)) return lang;
  }
  return DEFAULT_LOCALE;
}

// ---------------------------------------------------------------------------
// Public paths — no authentication required
// ---------------------------------------------------------------------------

/**
 * Routes that are accessible without a session (locale-stripped paths).
 */
const PUBLIC_PATHS: string[] = [
  '/',          // Landing page — public marketing page
  '/login',
  '/login/forgot-password',
  '/auth/confirm', // Supabase password-reset callback — user arrives unauthenticated with a ?code=
];

/**
 * Path prefixes that are always public regardless of auth state.
 * - /api/auth    — Supabase auth callbacks
 * - /api/cron/   — Vercel Cron jobs (secured via CRON_SECRET header in each handler)
 * - /api/avatar/ — Avatar upload from mobile (uses Authorization: Bearer, not cookies;
 *                  JWT validation is done inside the route handler itself)
 */
const PUBLIC_PREFIXES: string[] = [
  '/api/auth',
  '/api/cron/',
  '/api/avatar/',
];

function isPublicPath(strippedPathname: string): boolean {
  if (PUBLIC_PATHS.includes(strippedPathname)) return true;
  if (PUBLIC_PREFIXES.some((p) => strippedPathname.startsWith(p))) return true;
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
 * 1. Locale routing: redirect un-prefixed paths to the correct locale prefix
 *    (e.g. / → /en/, /dashboard → /en/dashboard).
 * 2. Refresh the Supabase session token (required by @supabase/ssr).
 * 3. Gate all non-public routes behind authentication:
 *    - API routes  → 401 JSON
 *    - All others  → redirect to /{locale}/login?redirectTo=<current-path>
 * 4. Redirect an already-authenticated user away from the login page.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ─────────────────────────────────────────────────────────────────────
  // API routes: auth check only, no locale redirect
  // ─────────────────────────────────────────────────────────────────────
  if (pathname.startsWith('/api/')) {
    if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) {
      return NextResponse.next({ request });
    }
    // For protected API routes, validate session
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder-anon-key',
      { cookies: { getAll: () => request.cookies.getAll(), setAll: () => {} } }
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new NextResponse(
        JSON.stringify({ error: 'Unauthenticated' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }
    return NextResponse.next({ request });
  }

  // ─────────────────────────────────────────────────────────────────────
  // Step 1: Locale redirect — add locale prefix if missing
  // ─────────────────────────────────────────────────────────────────────
  const localeInPath = getLocaleFromPath(pathname);
  if (!localeInPath) {
    const locale = detectLocale(request);
    const redirectUrl = new URL(
      `/${locale}${pathname === '/' ? '' : pathname}`,
      request.url
    );
    redirectUrl.search = request.nextUrl.search;
    const redirectResponse = NextResponse.redirect(redirectUrl);
    redirectResponse.cookies.set('NEXT_LOCALE', locale, { path: '/', sameSite: 'lax' });
    return redirectResponse;
  }

  const locale = localeInPath;
  const strippedPath = stripLocale(pathname);

  // ─────────────────────────────────────────────────────────────────────
  // Step 2: Supabase session refresh + auth gate
  // ─────────────────────────────────────────────────────────────────────

  // Pass locale to Server Components via request header
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-next-intl-locale', locale);

  let supabaseResponse = NextResponse.next({ request: { headers: requestHeaders } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder-anon-key',
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request: { headers: requestHeaders } });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 1. Allow public paths through
  if (isPublicPath(strippedPath)) {
    // Redirect authenticated user away from /login
    if (strippedPath === '/login' && user) {
      return NextResponse.redirect(new URL(`/${locale}/dashboard`, request.url));
    }
    return supabaseResponse;
  }

  // 2. Gate protected routes
  if (!user) {
    const loginUrl = new URL(`/${locale}/login`, request.url);
    loginUrl.searchParams.set('redirectTo', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 3. Authenticated — pass through
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
