export function getPsychAssessmentRoute(data: Record<string, unknown>): string | null {
  if (data.type !== 'psych_assessment_ready' || typeof data.assessment_id !== 'string') {
    return null;
  }
  return `/app/psych/${data.assessment_id}`;
}
