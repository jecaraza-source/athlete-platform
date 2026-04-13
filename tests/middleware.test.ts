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
// ===========================================================================

describe('middleware — public routes', () => {
  it('allows /login for anonymous users', async () => {
    currentUser = null;
    const res = await middleware(makeRequest('/login'));
    expect(res.status).toBe(200);
  });

  it('redirects authenticated users away from /login to /dashboard', async () => {
    currentUser = { id: 'auth-user-1' };
    const res = await middleware(makeRequest('/login'));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('https://example.com/dashboard');
  });

  it('allows public API auth routes through without a session', async () => {
    currentUser = null;
    const res = await middleware(makeRequest('/api/auth/callback'));
    expect(res.status).toBe(200);
  });
});

// ===========================================================================
// Protected page routes
// ===========================================================================

describe('middleware — protected pages for anonymous users', () => {
  it('redirects /admin to /login with redirectTo preserved', async () => {
    currentUser = null;
    const res = await middleware(makeRequest('/admin'));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('https://example.com/login?redirectTo=%2Fadmin');
  });

  it('redirects nested admin routes to /login with redirectTo preserved', async () => {
    currentUser = null;
    const res = await middleware(makeRequest('/admin/access-control/users'));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe(
      'https://example.com/login?redirectTo=%2Fadmin%2Faccess-control%2Fusers'
    );
  });

  it('redirects /follow-up to /login with redirectTo preserved', async () => {
    currentUser = null;
    const res = await middleware(makeRequest('/follow-up'));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('https://example.com/login?redirectTo=%2Ffollow-up');
  });

  it('redirects follow-up sub-routes to /login with redirectTo preserved', async () => {
    currentUser = null;
    const res = await middleware(makeRequest('/follow-up/physio'));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe(
      'https://example.com/login?redirectTo=%2Ffollow-up%2Fphysio'
    );
  });

  it('redirects /calendar to /login', async () => {
    currentUser = null;
    const res = await middleware(makeRequest('/calendar'));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('https://example.com/login?redirectTo=%2Fcalendar');
  });

  it('redirects /athletes/123 to /login', async () => {
    currentUser = null;
    const res = await middleware(makeRequest('/athletes/123'));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('https://example.com/login?redirectTo=%2Fathletes%2F123');
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
  it('allows authenticated users to access /admin', async () => {
    currentUser = { id: 'auth-user-1' };
    const res = await middleware(makeRequest('/admin'));
    expect(res.status).toBe(200);
  });

  it('allows authenticated users to access /follow-up/nutrition', async () => {
    currentUser = { id: 'auth-user-1' };
    const res = await middleware(makeRequest('/follow-up/nutrition'));
    expect(res.status).toBe(200);
  });

  it('allows authenticated users to access /calendar', async () => {
    currentUser = { id: 'auth-user-1' };
    const res = await middleware(makeRequest('/calendar'));
    expect(res.status).toBe(200);
  });

  it('allows authenticated users to access protected API routes', async () => {
    currentUser = { id: 'auth-user-1' };
    const res = await middleware(makeRequest('/api/private'));
    expect(res.status).toBe(200);
  });
});
