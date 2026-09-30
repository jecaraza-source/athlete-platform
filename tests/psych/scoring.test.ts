import { describe, expect, it } from 'vitest';
import { calculatePsychScores, type ScoringItem } from '@/lib/psych/scoring';

const options4 = [{ value: '1' }, { value: '2' }, { value: '3' }, { value: '4' }];
const options5 = [{ value: '1' }, { value: '2' }, { value: '3' }, { value: '4' }, { value: '5' }];

describe('calculatePsychScores', () => {
  it('applies reverse scoring to SMTQ subscales', () => {
    const items: ScoringItem[] = [
      { item_code: 'SMTQ-02', subscale_code: 'control', is_reverse_scored: true, response_options: options4 },
      { item_code: 'SMTQ-01', subscale_code: 'control', is_reverse_scored: false, response_options: options4 },
    ];
    expect(calculatePsychScores('SMTQ', items, [
      { item_code: 'SMTQ-02', raw_value: '4' },
      { item_code: 'SMTQ-01', raw_value: '3' },
    ])).toEqual([{ subscaleCode: 'control', rawScore: 4, band: null }]);
  });

  it('returns a 1-5 mean for TOPS subscales', () => {
    const items: ScoringItem[] = [
      { item_code: 'TOPS-04', subscale_code: 'practice_attentional_control', is_reverse_scored: true, response_options: options5 },
      { item_code: 'TOPS-19', subscale_code: 'practice_attentional_control', is_reverse_scored: false, response_options: options5 },
      { item_code: 'TOPS-45', subscale_code: 'practice_attentional_control', is_reverse_scored: false, response_options: options5 },
      { item_code: 'TOPS-50', subscale_code: 'practice_attentional_control', is_reverse_scored: true, response_options: options5 },
    ];
    expect(calculatePsychScores('TOPS', items, [
      { item_code: 'TOPS-04', raw_value: '5' },
      { item_code: 'TOPS-19', raw_value: '3' },
      { item_code: 'TOPS-45', raw_value: '5' },
      { item_code: 'TOPS-50', raw_value: '1' },
    ])).toEqual([{ subscaleCode: 'practice_attentional_control', rawScore: 3.5, band: null }]);
  });
});
