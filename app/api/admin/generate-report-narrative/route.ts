// =============================================================================
// app/api/admin/generate-report-narrative/route.ts
// Generates a 3-paragraph executive narrative from ReportData KPIs using
// Claude claude-opus-4-7 with adaptive thinking and streaming.
// Guarded by requireRouteAuth — only authenticated users with report access.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { requireRouteAuth } from '@/lib/rbac/server';
import type { ReportData } from '@/lib/types/admin';
import type { ReportPeriodMeta } from '@/lib/periods';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Stable system prompt — cached with cache_control: ephemeral to save tokens
// on repeated calls within the same session.
const SYSTEM_PROMPT = `Eres el analista de datos de AO Deporte, una organización deportiva de alto rendimiento en México.
Tu tarea es redactar una narrativa ejecutiva concisa basada en los indicadores (KPIs) de la plataforma para el período solicitado.

Reglas estrictas:
- Extensión: exactamente 3 párrafos de prosa corrida. Separa cada párrafo con una línea en blanco.
- Idioma: español formal.
- Tono: profesional, directo y orientado a resultados. Sin lenguaje de marketing ni clichés.
- Párrafo 1: Resumen de servicios de salud. Incluye citas programadas, atendidas (presencial y remoto), inasistencias y notas de seguimiento. Señala tendencias relevantes si existen.
- Párrafo 2: Desempeño de entrenadores y cobertura por disciplina. Menciona atletas con plan, planes asignados, seguimientos y la distribución de atletas por disciplina.
- Párrafo 3: Conclusión ejecutiva. Señala los logros del período, áreas de oportunidad concretas y una recomendación accionable para el equipo directivo.
- Usa los datos exactos del contexto proporcionado. No inventes ni infiera información adicional.
- No incluyas encabezados, listas, bullets ni formato especial. Solo prosa.`;

export async function POST(req: NextRequest) {
  // Auth guard — requires a valid session
  const denied = await requireRouteAuth();
  if (denied) return denied;

  try {
    const { data, meta } = (await req.json()) as {
      data: ReportData;
      meta: ReportPeriodMeta;
    };

    if (!data || !meta) {
      return NextResponse.json({ error: 'Faltan datos requeridos.' }, { status: 400 });
    }

    // Aggregate service KPIs for the prompt
    const totalScheduled  = data.services.reduce((s, r) => s + r.scheduled, 0);
    const totalPresential = data.services.reduce((s, r) => s + r.attendedPresential, 0);
    const totalRemote     = data.services.reduce((s, r) => s + (r.attendedRemote ?? 0), 0);
    const totalNoShow     = data.services.reduce((s, r) => s + r.noShow, 0);
    const totalNotes      = data.services.reduce((s, r) => s + r.followUpNotes, 0);

    const servicesDetail = data.services
      .map(
        (r) =>
          `  - ${r.service}: ${r.scheduled} programadas, ` +
          `${r.attendedPresential} presencial, ` +
          `${r.attendedRemote !== null ? r.attendedRemote + ' remoto' : 'NO APLICA remoto'}, ` +
          `${r.noShow} inasistencias, ${r.followUpNotes} notas`,
      )
      .join('\n');

    const coachesDetail =
      data.coaches.length > 0
        ? data.coaches
            .map(
              (c) =>
                `  - ${c.discipline.toUpperCase()} (${c.coachName}): ` +
                `${c.totalAthletes} atletas c/plan, ${c.totalPlans} planes, ${c.totalNotes} notas`,
            )
            .join('\n')
        : '  Sin datos de entrenadores en este período.';

    const disciplinesDetail =
      data.disciplines.length > 0
        ? data.disciplines
            .map(
              (d) =>
                `  - ${d.disciplineName}: ${d.totalAthletes} total, ` +
                `${d.athletesAttended} asistieron, ${d.athletesNoShow} no asistieron, ` +
                `${d.athletesWithPlans} con plan`,
            )
            .join('\n')
        : '  Sin datos de disciplinas en este período.';

    const userPrompt = `Redacta la narrativa ejecutiva para el siguiente reporte de AO Deporte.

PERÍODO: ${meta.label}
REPORTE: ${meta.reportTitle}
ATLETAS ACTIVOS: ${data.activeAthletes}

== SERVICIOS DE SALUD ==
Total citas programadas: ${totalScheduled}
Total atendidas presencial: ${totalPresential}
Total atendidas remoto: ${totalRemote}
Total inasistencias: ${totalNoShow}
Total notas de seguimiento: ${totalNotes}

Detalle por servicio:
${servicesDetail}

== ENTRENADORES ==
${coachesDetail}

== DISCIPLINAS ==
${disciplinesDetail}

Redacta ahora la narrativa ejecutiva de exactamente 3 párrafos:`;

    // Stream with finalMessage() to avoid HTTP timeouts on longer thinking traces
    const stream = await client.messages.stream({
      model: 'claude-opus-4-7',
      max_tokens: 4096,
      thinking: { type: 'adaptive' },
      system: [
        {
          type: 'text',
          text: SYSTEM_PROMPT,
          // Cache the stable system prompt to save input tokens on repeated calls
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{ role: 'user', content: userPrompt }],
    });

    const message = await stream.finalMessage();

    // Extract only text blocks (ignore thinking blocks)
    const narrative = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim();

    if (!narrative) {
      return NextResponse.json(
        { error: 'El modelo no devolvió texto. Intenta de nuevo.' },
        { status: 500 },
      );
    }

    return NextResponse.json({ narrative });
  } catch (err) {
    console.error('[generate-report-narrative]', err);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}
