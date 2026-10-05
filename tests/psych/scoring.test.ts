import { describe, expect, it } from 'vitest';
import { calculatePsychScores, supportsAutomaticScoring, type ScoringItem } from '@/lib/psych/scoring';

const options4 = [{ value: '1' }, { value: '2' }, { value: '3' }, { value: '4' }];
const options5 = [{ value: '1' }, { value: '2' }, { value: '3' }, { value: '4' }, { value: '5' }];

describe('calculatePsychScores', () => {
  it('requires manual review for instruments without an approved automated scoring policy', () => {
    const items: ScoringItem[] = [
      { item_code: 'SMTQ-02', subscale_code: 'control', is_reverse_scored: true, response_options: options4 },
      { item_code: 'SMTQ-01', subscale_code: 'control', is_reverse_scored: false, response_options: options4 },
    ];
    expect(calculatePsychScores('SMTQ', items, [
      { item_code: 'SMTQ-02', raw_value: '4' },
      { item_code: 'SMTQ-01', raw_value: '3' },
    ])).toEqual([]);
  });

  it('calculates SCAT and exposes its approved automated-scoring policy', () => {
    const items: ScoringItem[] = Array.from({ length: 9 }, (_, index) => ({
      item_code: `SCAT-${index + 1}`,
      subscale_code: 'trait_competitive_anxiety',
      is_reverse_scored: false,
      response_options: [{ value: '1' }, { value: '2' }, { value: '3' }],
    }));
    expect(supportsAutomaticScoring('SCAT')).toBe(true);
    expect(supportsAutomaticScoring('ABQ')).toBe(false);
    expect(calculatePsychScores('SCAT', items, items.map((item) => ({ item_code: item.item_code, raw_value: '3' })))).toEqual([
      { subscaleCode: 'trait_competitive_anxiety', rawScore: 27, band: 'ansiedad competitiva alta' },
    ]);
  });

  it('does not calculate TOPS scores until its validated policy is implemented', () => {
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
    ])).toEqual([]);
  });
});
