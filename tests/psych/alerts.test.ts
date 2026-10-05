import { describe, expect, it } from 'vitest';
import { derivePsychAlerts } from '@/lib/psych/alerts';

describe('derivePsychAlerts', () => {
  it('creates a high-severity alert only for a SCAT high-anxiety score', () => {
    expect(derivePsychAlerts('SCAT', [{
      subscaleCode: 'trait_competitive_anxiety',
      rawScore: 25,
      band: 'ansiedad competitiva alta',
    }])).toEqual([{
      type: 'elevated_competitive_anxiety',
      severity: 'high',
      notes: 'SCAT: ansiedad competitiva alta (puntaje 25). Requiere revisión clínica.',
    }]);
  });

  it('does not infer alerts for unsupported instruments or lower SCAT bands', () => {
    expect(derivePsychAlerts('SCAT', [{
      subscaleCode: 'trait_competitive_anxiety',
      rawScore: 24,
      band: 'ansiedad competitiva promedio',
    }])).toEqual([]);
    expect(derivePsychAlerts('SMTQ', [{
      subscaleCode: 'control',
      rawScore: 10,
      band: null,
    }])).toEqual([]);
  });
});
