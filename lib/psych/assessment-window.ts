export const PSYCH_ASSESSMENT_WINDOW_MS = 72 * 60 * 60 * 1000;

export function getPsychAssessmentExpiration(scheduledFor: string | null): Date | null {
  if (!scheduledFor) return null;

  const scheduledAt = new Date(scheduledFor);
  if (Number.isNaN(scheduledAt.getTime())) return null;

  return new Date(scheduledAt.getTime() + PSYCH_ASSESSMENT_WINDOW_MS);
}

export function isPsychAssessmentExpired(scheduledFor: string | null, now = new Date()): boolean {
  const expiration = getPsychAssessmentExpiration(scheduledFor);
  return expiration ? expiration.getTime() <= now.getTime() : false;
}
