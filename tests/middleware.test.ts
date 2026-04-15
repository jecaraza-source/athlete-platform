/**
 * Unit tests for middleware.ts
 *
 * Scope
 * -----
 * The middleware enforces the coarse "must be signed in" rule. It does NOT
 * check RBAC permissions — those are enforced deeper in pages/actions.
 *
 * These tests verify:
 *  - public paths stay accessible
 *  - unauthenticated users are redirected to /login for protected pages
 *  - the original destination is preserved in redirectTo
 *  - unauthenticated API routes receive a 401 JSON response
 *  - authenticated users pass through protected routes
 *  - authenticated users are redirected away from /login
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Shared mutable auth state for the mocked SSR client
// ---------------------------------------------------------------------------

let currentUser: { id: string } | null = null;

// ---------------------------------------------------------------------------
// Mock @supabase/ssr before importing the middleware module
// ---------------------------------------------------------------------------

vi.mock('@supabase/ssr', () => ({
  // The factory fn is called each time createServerClient() is invoked.
  // getUser uses mockImplementation (not mockResolvedValue) so it reads the
  // current value of `currentUser` at call time rather than at mock-setup time.
  createServerClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn().mockImplementation(() =>
        Promise.resolve({ data: { user: currentUser } })
      ),
    },
  })),
}));

// Import AFTER the mock is registered
import { proxy as middleware } from '@/proxy';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(path: string): NextRequest {
  return new NextRequest(new URL(`https://example.com${path}`));
}

async function jsonBody(response: Response) {
  return JSON.parse(await response.text());
}

// ---------------------------------------------------------------------------
// Per-test setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  currentUser = null;
});

// ===========================================================================
// Public routes
// NOTE: All page routes must include the locale prefix (/en/) because the
// middleware redirects any path without a locale prefix before applying the
// auth gate. API routes (/api/...) are exempt from locale handling.
// ===========================================================================

describe('middleware — public routes', () => {
  it('allows /en/login for anonymous users', async () => {
    currentUser = null;
    const res = await middleware(makeRequest('/en/login'));
    expect(res.status).toBe(200);
  });

  it('redirects un-prefixed paths to add locale prefix (anonymous)', async () => {
    currentUser = null;
    const res = await middleware(makeRequest('/login'));
    // Locale redirect fires before auth gate; default locale is "en"
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('https://example.com/en/login');
  });

  it('redirects authenticated users away from /en/login to /en/dashboard', async () => {
    currentUser = { id: 'auth-user-1' };
    const res = await middleware(makeRequest('/en/login'));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('https://example.com/en/dashboard');
  });

  it('allows public API auth routes through without a session', async () => {
    currentUser = null;
    const res = await middleware(makeRequest('/api/auth/callback'));
    expect(res.status).toBe(200);
  });
});

// ===========================================================================
// Protected page routes — tested with locale prefix
// ===========================================================================

describe('middleware — protected pages for anonymous users', () => {
  it('redirects /en/admin to /en/login with redirectTo preserved', async () => {
    currentUser = null;
    const res = await middleware(makeRequest('/en/admin'));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe(
      'https://example.com/en/login?redirectTo=%2Fen%2Fadmin'
    );
  });

  it('redirects nested /en/admin routes to /en/login with redirectTo preserved', async () => {
    currentUser = null;
    const res = await middleware(makeRequest('/en/admin/access-control/users'));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe(
      'https://example.com/en/login?redirectTo=%2Fen%2Fadmin%2Faccess-control%2Fusers'
    );
  });

  it('redirects /en/follow-up to /en/login with redirectTo preserved', async () => {
    currentUser = null;
    const res = await middleware(makeRequest('/en/follow-up'));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe(
      'https://example.com/en/login?redirectTo=%2Fen%2Ffollow-up'
    );
  });

  it('redirects /en/follow-up/physio to /en/login with redirectTo preserved', async () => {
    currentUser = null;
    const res = await middleware(makeRequest('/en/follow-up/physio'));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe(
      'https://example.com/en/login?redirectTo=%2Fen%2Ffollow-up%2Fphysio'
    );
  });

  it('redirects /en/calendar to /en/login', async () => {
    currentUser = null;
    const res = await middleware(makeRequest('/en/calendar'));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe(
      'https://example.com/en/login?redirectTo=%2Fen%2Fcalendar'
    );
  });

  it('redirects /en/athletes/123 to /en/login', async () => {
    currentUser = null;
    const res = await middleware(makeRequest('/en/athletes/123'));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe(
      'https://example.com/en/login?redirectTo=%2Fen%2Fathletes%2F123'
    );
  });

  it('adds locale prefix to un-prefixed protected path (307 locale redirect, not /login)', async () => {
    // The first redirect is always locale addition; a second request would then
    // hit the auth gate. This test confirms the locale redirect fires first.
    currentUser = null;
    const res = await middleware(makeRequest('/admin'));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('https://example.com/en/admin');
  });
});

// ===========================================================================
// Protected API routes
// ===========================================================================

describe('middleware — protected API routes for anonymous users', () => {
  it('returns 401 JSON for /api/anything when there is no session', async () => {
    currentUser = null;
    const res = await middleware(makeRequest('/api/private'));
    expect(res.status).toBe(401);
    expect(res.headers.get('content-type')).toContain('application/json');
    await expect(jsonBody(res)).resolves.toEqual({ error: 'Unauthenticated' });
  });
});

// ===========================================================================
// Authenticated pass-through
// ===========================================================================

describe('middleware — authenticated pass-through', () => {
  it('allows authenticated users to access /en/admin', async () => {
    currentUser = { id: 'auth-user-1' };
    const res = await middleware(makeRequest('/en/admin'));
    expect(res.status).toBe(200);
  });

  it('allows authenticated users to access /en/follow-up/nutrition', async () => {
    currentUser = { id: 'auth-user-1' };
    const res = await middleware(makeRequest('/en/follow-up/nutrition'));
    expect(res.status).toBe(200);
  });

  it('allows authenticated users to access /en/calendar', async () => {
    currentUser = { id: 'auth-user-1' };
    const res = await middleware(makeRequest('/en/calendar'));
    expect(res.status).toBe(200);
  });

  it('allows authenticated users to access protected API routes', async () => {
    currentUser = { id: 'auth-user-1' };
    const res = await middleware(makeRequest('/api/private'));
    expect(res.status).toBe(200);
  });
});
