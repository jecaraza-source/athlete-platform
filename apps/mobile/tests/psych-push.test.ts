import { describe, expect, it } from 'vitest';
import { getPsychAssessmentRoute } from '@/lib/psych-push';

describe('getPsychAssessmentRoute', () => {
  it('routes a psychological assessment notification to its assessment id', () => {
    expect(getPsychAssessmentRoute({
      type: 'psych_assessment_ready',
      assessment_id: 'assessment-fixture-id',
    })).toBe('/app/psych/assessment-fixture-id');
  });

  it('ignores unrelated or malformed notifications', () => {
    expect(getPsychAssessmentRoute({ type: 'newsletter_ready' })).toBeNull();
    expect(getPsychAssessmentRoute({ type: 'psych_assessment_ready' })).toBeNull();
  });
});
