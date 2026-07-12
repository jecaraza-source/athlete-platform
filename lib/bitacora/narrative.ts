import 'server-only';
// =============================================================================
// lib/bitacora/narrative.ts
// Generación de narrativa editorial para actividades usando la API de Anthropic.
// - Modelo: claude-opus-4-7 con adaptive thinking + streaming.
// - El system prompt estable se cachea con cache_control: { type: 'ephemeral' }.
// - Input multimodal: datos estructurados + imágenes (fotos featured) en base64.
// - Output: narrativa de 150-300 palabras en español, tono cálido y humano.
// =============================================================================

import Anthropic from '@anthropic-ai/sdk';
import type { ActivityWithRelations } from '@/lib/types/bitacora';
import { getHeroUrl } from '@/lib/storage-config';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MODEL = 'claude-opus-4-7';

// System prompt estable — se cachea entre llamadas consecutivas.
const SYSTEM_PROMPT = `Eres el editor de contenido de AO Deporte, una organización deportiva de alto rendimiento.
Tu tarea es redactar narrativas editoriales extensas y ricas para la Revista AO Deporte, dirigida a atletas, staff y sus familias.

Reglas de escritura:
- Tono: cercano, motivador y humano. No clínico ni técnico.
- Extensión: 450 a 700 palabras. La narrativa debe ser sustanciosa y rica en detalle.
- Idioma: español.
- Estructura: escribe en prosa corrida, sin encabezados ni listas. Organiza en 5 a 8 párrafos bien desarrollados:
    1. Párrafo de apertura: sitúa al lector en el momento y lugar del evento con vivacidad.
    2. Párrafos de contexto: explica la disciplina, el objetivo del evento y lo que estaba en juego.
    3. Párrafos de desarrollo: narra el transcurso del evento, los momentos clave, el ambiente, los esfuerzos visibles.
    4. Párrafo de personas: menciona (sin inventar nombres) el papel de atletas, staff y familias.
    5. Párrafo de cierre: reflexión inspiradora sobre el camino del deporte y la comunidad AO.
- Integra los datos del evento (disciplina, especialidad, sede, participantes, objetivo) con lo que describes visualmente en las fotos.
- Describe las imágenes con detalle sensorial: colores, gestos, ambiente, intensidad.
- Resalta la emoción, el esfuerzo colectivo y el logro de los atletas.
- No inventes datos que no estén en el contexto provisto.
- No menciones información médica ni datos de salud.`;

export interface NarrativeGenerationInput {
  activity:     ActivityWithRelations;
  /** Máximo de fotos featured (o las primeras N) a incluir en el mensaje multimodal. */
  maxPhotos?:   number;
}

export interface NarrativeGenerationResult {
  narrative_text: string;
  model_used:     string;
}

/**
 * Genera una narrativa editorial para una actividad usando claude-opus-4-7.
 *
 * Las fotos marcadas como `featured` (o las primeras `maxPhotos`) se descargan
 * y envían como bloques de imagen en el mensaje para que el modelo pueda
 * describir la historia gráfica con base en contenido visual real.
 *
 * @throws Error si la actividad no es elegible para narrativa editorial.
 */
export async function generateNarrative(
  input: NarrativeGenerationInput
): Promise<NarrativeGenerationResult> {
  const { activity, maxPhotos = 6 } = input;

  // Guardia de privacidad: nunca generar para actividades no elegibles
  if (!activity.editorial_eligible) {
    throw new Error(
      'Esta actividad no es elegible para narrativa editorial. ' +
      'Para incluirla, un admin debe marcar editorial_eligible = true.'
    );
  }

  // Seleccionar fotos a enviar: featured primero, luego por display_order
  const featuredPhotos = activity.photos.filter((p) => p.featured);
  const otherPhotos    = activity.photos.filter((p) => !p.featured);
  const photosToSend   = [...featuredPhotos, ...otherPhotos].slice(0, maxPhotos);

  // Construir bloques de imagen descargando cada foto
  const imageBlocks: Anthropic.ImageBlockParam[] = [];
  for (const photo of photosToSend) {
    try {
      const url      = getHeroUrl(photo.storage_path);
      const response = await fetch(url);
      if (!response.ok) continue;

      const buffer     = await response.arrayBuffer();
      const base64     = Buffer.from(buffer).toString('base64');
      const mediaType  = (response.headers.get('content-type') as Anthropic.Base64ImageSource['media_type'])
        ?? 'image/jpeg';

      imageBlocks.push({
        type:   'image',
        source: { type: 'base64', media_type: mediaType, data: base64 },
      });

      // Agregar caption/alt_text como contexto si están disponibles
      if (photo.caption || photo.alt_text) {
        // Se incluirá en el texto contextual más abajo
      }
    } catch {
      // Si una foto falla, continuamos con las demás
    }
  }

  // Construir el texto de contexto estructurado
  const photoContextLines = photosToSend
    .filter((p) => p.caption || p.alt_text)
    .map((p, i) => {
      const desc = p.caption || p.alt_text;
      return `  Foto ${i + 1}: ${desc}`;
    })
    .join('\n');

  const userPrompt = `
A continuación te proporciono los datos de una actividad deportiva y las fotos del evento.
Redacta la narrativa editorial según las instrucciones del system prompt.

=== DATOS DEL EVENTO ===
Tipo: ${activity.type === 'evento_deportivo' ? 'Evento Deportivo' : 'Consulta'}
Título: ${activity.title}
Fecha: ${activity.event_date ?? 'No especificada'}
Horario: ${activity.horario ?? 'No especificado'}
Lugar / Dirección: ${activity.location ?? 'No especificado'}
Sede: ${activity.sede ?? 'No especificada'}
Disciplina: ${activity.disciplina ?? 'No especificada'}
Especialidad: ${activity.especialidad ?? 'No especificada'}
Tipo de actividad: ${activity.actividad_tipo ?? 'No especificado'}
Número de participantes: ${activity.numero_participantes ?? 'No especificado'}
Personal requerido: ${activity.personal_requerido ?? 'No especificado'}
Objetivo: ${activity.objetivo ?? 'Sin objetivo declarado'}
Descripción: ${activity.description ?? 'Sin descripción adicional'}
Tags: ${activity.tags.length > 0 ? activity.tags.join(', ') : 'Ninguno'}

${photoContextLines ? `=== CONTEXTO DE FOTOS ===\n${photoContextLines}\n` : ''}
=== FOTOS DEL EVENTO ===
(Las imágenes están adjuntas arriba. Descríbelas con detalle sensorial e intégralas a lo largo de la narrativa.)

Escribe ahora la narrativa editorial extensa (450-700 palabras):`.trim();

  // Construir el mensaje multimodal (imágenes + texto)
  const userContent: Anthropic.MessageParam['content'] = [
    ...imageBlocks,
    { type: 'text', text: userPrompt },
  ];

  // Llamada a la API con streaming para evitar timeouts en respuestas largas
  const stream = await client.messages.stream({
    model:      MODEL,
    max_tokens: 2048,
    thinking:   { type: 'adaptive' },
    system: [
      {
        type:          'text',
        text:          SYSTEM_PROMPT,
        // Cachear el system prompt estable — ahorra tokens en llamadas sucesivas
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [{ role: 'user', content: userContent }],
  });

  const message = await stream.finalMessage();

  // Extraer el texto de la respuesta (ignorar bloques de thinking)
  const narrativeText = message.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('')
    .trim();

  if (!narrativeText) {
    throw new Error('El modelo no devolvió texto en la narrativa. Intenta regenerar.');
  }

  return {
    narrative_text: narrativeText,
    model_used:     MODEL,
  };
}
