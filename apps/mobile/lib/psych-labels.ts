/**
 * Spanish copy for psychological tests in the mobile app, mirroring the web
 * catalog (psych.common.instrumentAbout / subscale). Unknown codes fall back
 * to a readable form of the raw value.
 */

const INSTRUMENT_ABOUT: Record<string, string> = {
  ABQ: 'Mide señales de agotamiento deportivo (burnout): cansancio físico y emocional, sentido de logro y valoración del deporte.',
  'ACSI-28': 'Evalúa tus habilidades para afrontar las exigencias del deporte, como concentración, confianza y manejo de la presión.',
  'BASC-3-PRS-C': 'Describe conductas y emociones observadas en el día a día.',
  'CSAI-2': 'Mide cómo vives la ansiedad y la confianza antes de competir.',
  POMS: 'Describe tu estado de ánimo reciente.',
  'RESTQ-Sport': 'Compara tu nivel de estrés con tu capacidad de recuperación.',
  SCAT: 'Mide la tendencia a sentir ansiedad en situaciones de competencia.',
  SMS: 'Explora qué te motiva a practicar tu deporte.',
  SMTQ: 'Mide tu fortaleza mental: confianza, constancia y control.',
  TAIS: 'Describe tu estilo de atención y de relación con los demás.',
  TOPS: 'Revisa las estrategias psicológicas que usas en entrenamientos y competencias.',
};

const SUBSCALE_LABELS: Record<string, string> = {
  cognitive_anxiety: 'Ansiedad cognitiva',
  somatic_anxiety: 'Ansiedad somática',
  self_confidence: 'Autoconfianza',
  trait_competitive_anxiety: 'Ansiedad competitiva',
  physical_emotional_exhaustion: 'Agotamiento físico/emocional',
  reduced_sense_of_accomplishment: 'Reducción del sentido de logro',
  sport_devaluation: 'Devaluación del deporte',
  confidence: 'Confianza',
  constancy: 'Constancia',
  control: 'Control',
};

export function instrumentAbout(code: string): string | null {
  return INSTRUMENT_ABOUT[code] ?? null;
}

export function subscaleLabel(code: string): string {
  return SUBSCALE_LABELS[code] ?? code.replaceAll('_', ' ');
}

/** "14 de octubre de 2026" in Mexico City time. */
export function formatPsychDate(value: string): string {
  return new Date(value).toLocaleDateString('es-MX', {
    timeZone: 'America/Mexico_City',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function daysLeftLabel(daysLeft: number): string {
  if (daysLeft <= 0) return 'Vence hoy';
  return daysLeft === 1 ? 'Queda 1 día' : `Quedan ${daysLeft} días`;
}
