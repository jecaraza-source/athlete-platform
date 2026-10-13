import type { CalculatedScore } from '@/lib/psych/scoring';

export type DerivedPsychAlert = {
  type: string;
  severity: 'low' | 'medium' | 'high';
  notes: string;
};

/**
 * Only creates alerts for thresholds represented by an approved scoring rule.
 * Additional instruments must add their validated threshold here before they
 * can generate automated clinical alerts.
 */
export function derivePsychAlerts(
  instrumentCode: string,
  scores: CalculatedScore[]
): DerivedPsychAlert[] {
  if (instrumentCode !== 'SCAT') return [];

  const competitiveAnxiety = scores.find(
    (score) => score.subscaleCode === 'trait_competitive_anxiety'
  );
  if (competitiveAnxiety?.band !== 'ansiedad competitiva alta') return [];

  return [{
    type: 'elevated_competitive_anxiety',
    severity: 'high',
    notes: `SCAT: ansiedad competitiva alta (puntaje ${competitiveAnxiety.rawScore}). Requiere revisión clínica.`,
  }];
}
