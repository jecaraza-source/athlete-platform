import { describe, expect, it } from 'vitest';
import { validatePsychSubmission } from '@/lib/psych/submission';
import type { ScoringItem } from '@/lib/psych/scoring';

const items: ScoringItem[] = [
  { item_code: 'ITEM-1', subscale_code: 'focus', is_reverse_scored: false, response_options: [{ value: '1' }, { value: '2' }] },
  { item_code: 'ITEM-2', subscale_code: 'focus', is_reverse_scored: false, response_options: ['never', 'always'] },
];

describe('validatePsychSubmission', () => {
  it('accepts one permitted response for every registered item', () => {
    expect(validatePsychSubmission(items, [
      { item_code: 'ITEM-1', raw_value: '2' },
      { item_code: 'ITEM-2', raw_value: 'always' },
    ])).toEqual({});
  });

  it('rejects incomplete, unknown, duplicated, and unsupported responses before persistence', () => {
    expect(validatePsychSubmission(items, [{ item_code: 'ITEM-1', raw_value: '1' }]).error).toBeTruthy();
    expect(validatePsychSubmission(items, [
      { item_code: 'ITEM-1', raw_value: '3' },
      { item_code: 'ITEM-2', raw_value: 'always' },
    ]).error).toContain('no es válida');
    expect(validatePsychSubmission(items, [
      { item_code: 'ITEM-1', raw_value: '1' },
      { item_code: 'ITEM-1', raw_value: '2' },
    ]).error).toBeTruthy();
  });
});
