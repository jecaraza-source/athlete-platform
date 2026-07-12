/**
 * lib/cron/auth.ts
 *
 * Shared CRON_SECRET guard for Vercel Cron route handlers.
 *
 * Usage inside any /api/cron/* handler:
 *
 *   import { requireCronAuth } from '@/lib/cron/auth';
 *
 *   export async function GET(req: NextRequest) {
 *     const denied = requireCronAuth(req);
 *     if (denied) return denied;
 *     // … handler logic
 *   }
 *
 * Vercel sends the secret in the Authorization header as:
 *   Authorization: Bearer <CRON_SECRET>
 *
 * The check is synchronous — no DB or network calls needed.
 */

import { NextRequest, NextResponse } from 'next/server';

/**
 * Returns a 401 JSON Response when the request does not carry a valid
 * CRON_SECRET bearer token. Returns null when the caller is authorized.
 *
 * Also returns 401 if CRON_SECRET is not set in the environment, which
 * prevents accidentally exposing cron endpoints in environments where
 * the secret was never configured.
 */
export function requireCronAuth(req: NextRequest): NextResponse | null {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get('authorization');

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return null;
}
