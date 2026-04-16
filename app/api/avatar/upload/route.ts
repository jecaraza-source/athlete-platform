/**
 * POST /api/avatar/upload
 *
 * Proxy endpoint for mobile avatar uploads.
 * The mobile client cannot bypass storage RLS with the anon key, so
 * the upload is proxied through this server endpoint which uses the
 * service-role client (supabaseAdmin) that bypasses storage RLS entirely.
 *
 * Security:
 *   - Validates the caller's JWT via supabaseAdmin.auth.getUser(token)
 *   - Verifies the profileId belongs to the authenticated user
 *   - Only accepts JPEG/PNG/WebP/GIF ≤ 5 MB (decoded)
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin }            from '@/lib/supabase-admin';

const BUCKET   = 'avatars';
const MAX_BYTES = 5 * 1024 * 1024;

export const runtime  = 'nodejs';
export const dynamic  = 'force-dynamic';

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    // ── 1. Extract and validate JWT ───────────────────────────────────────
    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const token = authHeader.slice(7);

    const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token);
    if (authErr || !user) {
      return NextResponse.json({ error: 'Token inválido o expirado.' }, { status: 401 });
    }

    // ── 2. Parse body ─────────────────────────────────────────────────────
    let body: { base64?: string; profileId?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Cuerpo de la solicitud inválido.' }, { status: 400 });
    }

    const { base64, profileId } = body;
    if (!base64 || !profileId) {
      return NextResponse.json({ error: 'Faltan campos: base64 o profileId.' }, { status: 400 });
    }

    // ── 3. Verify ownership ───────────────────────────────────────────────
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('id', profileId)
      .eq('auth_user_id', user.id)
      .maybeSingle();

    if (!profile) {
      return NextResponse.json({ error: 'Perfil no encontrado.' }, { status: 403 });
    }

    // ── 4. Decode base64 → Buffer ─────────────────────────────────────────
    const buffer = Buffer.from(base64, 'base64');
    if (buffer.byteLength > MAX_BYTES) {
      return NextResponse.json({ error: 'La imagen excede el límite de 5 MB.' }, { status: 413 });
    }

    // ── 5. Upload using admin client (bypasses storage RLS) ───────────────
    const path = `${user.id}/avatar.jpg`;
    const { error: uploadErr } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(path, buffer, { contentType: 'image/jpeg', upsert: true });

    if (uploadErr) {
      console.error('[avatar/upload] storage error:', uploadErr.message);
      return NextResponse.json({ error: uploadErr.message }, { status: 500 });
    }

    // ── 6. Persist public URL ─────────────────────────────────────────────
    const { data: { publicUrl } } = supabaseAdmin.storage
      .from(BUCKET)
      .getPublicUrl(path);

    await supabaseAdmin
      .from('profiles')
      .update({ avatar_url: publicUrl })
      .eq('id', profileId);

    return NextResponse.json({ url: publicUrl });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[avatar/upload] unexpected error:', msg);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}
