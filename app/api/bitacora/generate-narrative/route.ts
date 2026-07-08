// =============================================================================
// app/api/bitacora/generate-narrative/route.ts
// POST /api/bitacora/generate-narrative
//
// Genera una narrativa editorial para una actividad usando Claude.
// Requiere autenticación admin. El resultado se guarda como status='borrador'
// en activity_narratives — nunca se publica sin revisión humana.
// =============================================================================

import { requireRouteAuth } from '@/lib/rbac/server';
import { getCurrentUser }   from '@/lib/rbac/server';
import { supabaseAdmin }    from '@/lib/supabase-admin';
import { generateNarrative } from '@/lib/bitacora/narrative';
import { getAdminActivityById } from '@/lib/bitacora/queries';

export async function POST(request: Request): Promise<Response> {
  // ── 1. Auth & admin check ─────────────────────────────────────────────────
  const authDenied = await requireRouteAuth();
  if (authDenied) return authDenied;

  const user = await getCurrentUser();
  const isAdmin = user?.roles.some((r) =>
    ['super_admin', 'admin', 'program_director'].includes(r.code)
  );
  if (!isAdmin) {
    return Response.json({ error: 'Se requiere acceso admin.' }, { status: 403 });
  }

  // ── 2. Parse body ─────────────────────────────────────────────────────────
  let activityId: string;
  try {
    const body    = await request.json() as { activity_id?: string };
    activityId    = body.activity_id ?? '';
  } catch {
    return Response.json({ error: 'Body JSON inválido.' }, { status: 400 });
  }

  if (!activityId) {
    return Response.json({ error: 'activity_id es requerido.' }, { status: 400 });
  }

  // ── 3. Obtener actividad con relaciones ───────────────────────────────────
  const activity = await getAdminActivityById(activityId);
  if (!activity) {
    return Response.json({ error: 'Actividad no encontrada.' }, { status: 404 });
  }

  // ── 4. Validar elegibilidad editorial ─────────────────────────────────────
  if (!activity.editorial_eligible) {
    return Response.json(
      {
        error:
          'Esta actividad no es elegible para narrativa editorial. ' +
          'Marca editorial_eligible = true para incluirla.',
      },
      { status: 422 }
    );
  }

  if (activity.status !== 'publicado') {
    return Response.json(
      { error: 'La actividad debe estar publicada antes de generar narrativa.' },
      { status: 422 }
    );
  }

  // ── 5. Generar narrativa con Anthropic ────────────────────────────────────
  let result: { narrative_text: string; model_used: string };
  try {
    result = await generateNarrative({ activity });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: `Error al generar narrativa: ${message}` }, { status: 500 });
  }

  // ── 6. Guardar en BD (upsert: reemplaza borrador/rechazado existente) ─────
  const { data: saved, error: dbError } = await supabaseAdmin
    .from('activity_narratives')
    .upsert(
      {
        activity_id:    activityId,
        narrative_text: result.narrative_text,
        model_used:     result.model_used,
        status:         'borrador',
        generated_at:   new Date().toISOString(),
        approved_by:    null,
        approved_at:    null,
      },
      { onConflict: 'activity_id' }
    )
    .select('id, status, generated_at')
    .single();

  if (dbError) {
    return Response.json({ error: `Error al guardar narrativa: ${dbError.message}` }, { status: 500 });
  }

  return Response.json({
    ok:             true,
    narrative_id:   saved.id,
    narrative_text: result.narrative_text,
    model_used:     result.model_used,
    status:         saved.status,
    generated_at:   saved.generated_at,
  });
}
