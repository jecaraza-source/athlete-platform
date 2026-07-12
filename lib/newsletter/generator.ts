// =============================================================================
// lib/newsletter/generator.ts
// Generates newsletter tips via Claude API and builds the email HTML.
// Server-only — uses ANTHROPIC_API_KEY env var.
// =============================================================================

import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { TZ } from '@/lib/timezone';
import type { NewsletterAudiencia, NewsletterContent, Tip } from './types';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ---------------------------------------------------------------------------
// Topic pools
// ---------------------------------------------------------------------------

const ATHLETE_TOPICS = [
  'hidratación y rendimiento deportivo',
  'recuperación muscular post-entrenamiento',
  'técnica específica de disciplina',
  'mentalidad y concentración',
  'nutrición pre y post competencia',
  'prevención de lesiones comunes',
  'descanso y calidad del sueño',
  'calentamiento y enfriamiento efectivos',
];

const COACH_TOPICS = [
  'periodización y planificación del entrenamiento',
  'comunicación efectiva con atletas',
  'análisis de datos de rendimiento',
  'liderazgo y motivación del equipo',
  'gestión de carga y prevención del sobreentrenamiento',
  'tácticas de competencia y toma de decisiones',
  'retroalimentación constructiva y desarrollo del atleta',
  'psicología del deporte aplicada al coaching',
];

// Pick 3 unique topics at random for variety
function pickTopics(pool: string[]): string[] {
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 3);
}

// ---------------------------------------------------------------------------
// Content generation
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `Eres un experto en rendimiento deportivo de alto nivel para la plataforma AO Deportes.
Generas contenido práctico, motivador y científicamente fundamentado para atletas y coaches de élite.
Respondes ÚNICAMENTE con JSON válido, sin markdown, sin backticks, sin texto adicional.
El JSON debe seguir exactamente el esquema indicado en el prompt del usuario.`;

export async function generateNewsletterContent(
  audiencia: NewsletterAudiencia
): Promise<NewsletterContent> {
  const isAthlete = audiencia === 'atleta';
  const topics    = isAthlete ? pickTopics(ATHLETE_TOPICS) : pickTopics(COACH_TOPICS);
  const rol       = isAthlete ? 'atletas de alto rendimiento' : 'coaches y entrenadores deportivos';
  const topicList = topics.map((t, i) => `  ${i + 1}. ${t}`).join('\n');

  const today = new Date().toLocaleDateString('es-MX', {
    timeZone: TZ,
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const userPrompt = `Genera un newsletter diario de AO Deportes para ${rol}.
Fecha: ${today}

Temas de hoy:
${topicList}

Devuelve JSON con este esquema EXACTO (sin backticks, sin markdown):
{
  "asunto": "línea de asunto del email (máx 70 caracteres, atractiva y específica)",
  "preview": "texto de preview del email (máx 120 caracteres, complementa el asunto)",
  "intro": "párrafo introductorio cálido y motivador (2-3 oraciones, máx 200 caracteres)",
  "tips": [
    {
      "emoji": "un emoji representativo",
      "categoria": "nombre corto de la categoría (máx 20 caracteres)",
      "titulo": "título del tip (máx 60 caracteres)",
      "contenido": "contenido práctico y accionable (2-3 oraciones, máx 300 caracteres)"
    }
  ]
}

Genera exactamente 3 tips, uno por cada tema de la lista. Sé concreto, práctico y motivador.`;

  const message = await client.messages.create({
    model:      'claude-opus-4-7',
    max_tokens: 1024,
    system: [
      {
        type: 'text',
        text: SYSTEM_PROMPT,
        // Prompt caching: the system prompt is stable across all newsletter calls
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [{ role: 'user', content: userPrompt }],
  });

  const raw = message.content
    .filter((b) => b.type === 'text')
    .map((b) => (b as { type: 'text'; text: string }).text)
    .join('');

  // Strip any accidental markdown fences
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();

  const parsed = JSON.parse(cleaned) as NewsletterContent;

  // Validate structure
  if (!parsed.asunto || !parsed.tips || parsed.tips.length !== 3) {
    throw new Error('Claude returned invalid newsletter structure');
  }

  return parsed;
}

// ---------------------------------------------------------------------------
// Email HTML builder
// ---------------------------------------------------------------------------

const BRAND_RED  = '#C0172C';
const BRAND_DARK = '#1a1a1a';

export function buildEmailHTML(
  content: NewsletterContent,
  audiencia: NewsletterAudiencia,
  appUrl: string,
  customMessage?: { title?: string | null; body?: string | null }
): string {
  const audienciaLabel = audiencia === 'atleta' ? 'Atletas' : 'Coaches';
  const tipsHtml = content.tips.map((tip: Tip) => /* html */`
    <tr>
      <td style="padding: 0 0 24px 0;">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
          <tr>
            <td style="
              background-color: #fafafa;
              border-left: 4px solid ${BRAND_RED};
              border-radius: 0 6px 6px 0;
              padding: 16px 20px;
            ">
              <p style="
                margin: 0 0 4px 0;
                font-family: Georgia, 'Times New Roman', serif;
                font-size: 11px;
                font-weight: bold;
                text-transform: uppercase;
                letter-spacing: 1px;
                color: ${BRAND_RED};
              ">${tip.emoji} ${tip.categoria}</p>
              <p style="
                margin: 0 0 8px 0;
                font-family: Georgia, 'Times New Roman', serif;
                font-size: 17px;
                font-weight: bold;
                color: ${BRAND_DARK};
                line-height: 1.3;
              ">${tip.titulo}</p>
              <p style="
                margin: 0;
                font-family: Georgia, 'Times New Roman', serif;
                font-size: 15px;
                color: #444444;
                line-height: 1.6;
              ">${tip.contenido}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `).join('');

  const today = new Date().toLocaleDateString('es-MX', {
    timeZone: TZ,
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  return /* html */`<!DOCTYPE html>
<html lang="es" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>${content.asunto}</title>
  <!--[if mso]>
  <noscript>
    <xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml>
  </noscript>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; background-color: #f0f0f0; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%;">

  <!-- Preheader (hidden) -->
  <div style="display: none; max-height: 0; overflow: hidden; mso-hide: all;">
    ${content.preview}&nbsp;&#847;&nbsp;
  </div>

  <!-- Wrapper -->
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color: #f0f0f0;">
    <tr>
      <td align="center" style="padding: 32px 16px;">

        <!-- Container -->
        <table width="600" cellpadding="0" cellspacing="0" role="presentation"
          style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 8px; overflow: hidden;">

          <!-- Logo section -->
          <tr>
            <td style="
              background-color: #ffffff;
              padding: 24px 32px 18px;
              text-align: center;
              border-bottom: 3px solid ${BRAND_RED};
            ">
              <!-- Logo: AO Deporte brand logo (includes text) -->
              <img
                src="${appUrl}/logo.png"
                alt="AO Deportes"
                width="180"
                style="
                  display: block;
                  margin: 0 auto 10px;
                  width: 180px;
                  height: auto;
                  border: 0;
                "
              />
              <!-- Newsletter category + date -->
              <p style="
                margin: 0;
                font-family: Georgia, 'Times New Roman', serif;
                font-size: 11px;
                font-weight: bold;
                text-transform: uppercase;
                letter-spacing: 2px;
                color: #888888;
              ">Newsletter ${audienciaLabel} &middot; ${today}</p>
            </td>
          </tr>

          <!-- Red header band -->
          <tr>
            <td style="background-color: ${BRAND_RED}; padding: 20px 32px; text-align: center;">
              <h1 style="
                margin: 0;
                font-family: Georgia, 'Times New Roman', serif;
                font-size: 22px;
                font-weight: bold;
                color: #ffffff;
                line-height: 1.3;
              ">${content.asunto}</h1>
            </td>
          </tr>


          <!-- Intro -->
          <tr>
            <td style="padding: 28px 32px 16px 32px;">
              <p style="
                margin: 0;
                font-family: Georgia, 'Times New Roman', serif;
                font-size: 16px;
                color: #333333;
                line-height: 1.7;
              ">${content.intro}</p>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding: 8px 32px 20px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td style="border-top: 2px solid ${BRAND_RED}; font-size: 1px; line-height: 1px;">&nbsp;</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Tips section title -->
          <tr>
            <td style="padding: 0 32px 12px 32px;">
              <p style="
                margin: 0;
                font-family: Georgia, 'Times New Roman', serif;
                font-size: 12px;
                font-weight: bold;
                text-transform: uppercase;
                letter-spacing: 1.5px;
                color: #888888;
              ">Tips de hoy</p>
            </td>
          </tr>

          <!-- Tips -->
          <tr>
            <td style="padding: 0 32px 8px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                ${tipsHtml}
              </table>
            </td>
          </tr>

          <!-- Custom message (optional notice / reminder) -->
          ${customMessage?.body ? `
          <tr>
            <td style="padding: 8px 32px 20px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td style="
                    background-color: #eff6ff;
                    border-left: 4px solid #3b82f6;
                    border-radius: 0 8px 8px 0;
                    padding: 18px 20px;
                  ">
                    <p style="
                      margin: 0 0 6px 0;
                      font-family: Georgia, 'Times New Roman', serif;
                      font-size: 11px;
                      font-weight: bold;
                      text-transform: uppercase;
                      letter-spacing: 1px;
                      color: #1d4ed8;
                    ">📢 ${customMessage.title || 'Aviso'}</p>
                    <p style="
                      margin: 0;
                      font-family: Georgia, 'Times New Roman', serif;
                      font-size: 15px;
                      color: #1e3a5f;
                      line-height: 1.6;
                      white-space: pre-line;
                    ">${customMessage.body}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>` : ''}

          <!-- CTA -->
          <tr>
            <td style="padding: 8px 32px 32px 32px; text-align: center;">
              <table cellpadding="0" cellspacing="0" role="presentation" style="margin: 0 auto;">
                <tr>
                  <td style="
                    background-color: ${BRAND_RED};
                    border-radius: 6px;
                  ">
                    <a href="${appUrl}"
                      style="
                        display: inline-block;
                        padding: 14px 28px;
                        font-family: Georgia, 'Times New Roman', serif;
                        font-size: 15px;
                        font-weight: bold;
                        color: #ffffff;
                        text-decoration: none;
                        border-radius: 6px;
                      ">
                      Abrir plataforma →
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="
              background-color: #f8f8f8;
              border-top: 1px solid #e5e5e5;
              padding: 20px 32px;
              text-align: center;
            ">
              <p style="
                margin: 0 0 6px 0;
                font-family: Georgia, 'Times New Roman', serif;
                font-size: 13px;
                font-weight: bold;
                color: ${BRAND_DARK};
              ">AO Deportes</p>
              <p style="
                margin: 0;
                font-family: Georgia, 'Times New Roman', serif;
                font-size: 11px;
                color: #999999;
                line-height: 1.6;
              ">
                Recibiste este correo porque eres parte del programa AO Deportes.<br />
                <a href="{{action.unsubscribe}}"
                  style="color: #999999; text-decoration: underline;">
                  Cancelar suscripción
                </a>
              </p>
            </td>
          </tr>

        </table>
        <!-- /Container -->

      </td>
    </tr>
  </table>
  <!-- /Wrapper -->

</body>
</html>`;
}
