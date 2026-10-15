/**
 * Psych module localisation and grading helpers:
 *  - es/en catalogs expose the same psych keys, and the English menu says "Test"
 *  - psych UI files carry no hard-coded Spanish copy or es-MX dates
 *  - label fallbacks, readable responses, grading stage, athlete search and
 *    the completion deadline behave as the screens expect
 */

import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { psychDateLocale, psychLabel } from '@/lib/psych/labels';
import { buildReadableResponses } from '@/lib/psych/responses';
import { assessmentStage } from '@/lib/psych/stage';
import { filterAthleteOptions } from '@/lib/psych/athlete-search';
import { assessmentDeadline, PSYCH_COMPLETION_WINDOW_DAYS } from '@/lib/psych/deadline';

const ROOT = path.resolve(__dirname, '../..');
const readJson = (file: string) => JSON.parse(readFileSync(path.join(ROOT, file), 'utf8'));

function keyPaths(value: unknown, prefix = ''): string[] {
  if (!value || typeof value !== 'object') return [prefix];
  return Object.entries(value).flatMap(([key, child]) => keyPaths(child, prefix ? `${prefix}.${key}` : key));
}

describe('psych translations', () => {
  const es = readJson('messages/es.json');
  const en = readJson('messages/en.json');

  it('defines the same psych keys in Spanish and English', () => {
    expect(keyPaths(en.psych).sort()).toEqual(keyPaths(es.psych).sort());
  });

  it('labels the English menu entry as "Test"', () => {
    expect(en.nav.psychologicalTests).toBe('Test');
    expect(en.psych.athlete.eyebrow).toBe('Test');
  });

  it('leaves no hard-coded Spanish copy or es-MX dates in psych screens', () => {
    const files = [
      ...readdirSync(path.join(ROOT, 'components/psych')).map((file) => `components/psych/${file}`),
      'app/[locale]/(app)/dashboard/psych/page.tsx',
      'app/[locale]/(app)/dashboard/psych/overview/page.tsx',
      'app/[locale]/(app)/dashboard/mental-health/page.tsx',
      'app/[locale]/(app)/dashboard/mental-health/assessments/[id]/page.tsx',
      'app/[locale]/(app)/dashboard/coach/psych/page.tsx',
    ];
    for (const file of files) {
      const source = readFileSync(path.join(ROOT, file), 'utf8');
      expect(source, file).not.toMatch(/[áéíóúñ¿¡]/i);
      expect(source, file).not.toContain("'es-MX'");
    }
  });
});

describe('psychLabel', () => {
  const t = Object.assign((key: string) => `translated:${key}`, {
    has: (key: string) => key === 'band.ansiedad_competitiva_alta',
  });

  it('translates known database codes, including space-separated bands', () => {
    expect(psychLabel(t, 'band', 'ansiedad competitiva alta')).toBe('translated:band.ansiedad_competitiva_alta');
  });

  it('falls back to a readable raw value for unknown codes', () => {
    expect(psychLabel(t, 'subscale', 'new_subscale_code')).toBe('new subscale code');
  });

  it('maps app locales to date locales', () => {
    expect(psychDateLocale('en')).toBe('en-US');
    expect(psychDateLocale('es')).toBe('es-MX');
  });
});

describe('buildReadableResponses', () => {
  it('pairs each answer with its prompt, option label and scoring flags in item order', () => {
    const rows = buildReadableResponses(
      [
        { item_code: 'ABQ-2', item_order: 2, prompt_text: 'Segunda', response_options: [{ value: '1', label: 'Casi nunca' }, { value: '5', label: 'Casi siempre' }], subscale_code: 'sport_devaluation', is_reverse_scored: true },
        { item_code: 'ABQ-1', item_order: 1, prompt_text: 'Primera', response_options: ['1', '2'], subscale_code: 'unscored', is_reverse_scored: false },
      ],
      [
        { item_code: 'ABQ-2', raw_value: '5', created_at: '2026-10-10T15:00:00Z' },
        { item_code: 'ABQ-1', raw_value: '2', created_at: '2026-10-10T15:00:00Z' },
        { item_code: 'LEGACY', raw_value: '3', created_at: '2026-10-10T15:00:00Z' },
      ],
    );

    expect(rows.map((row) => row.itemCode)).toEqual(['ABQ-1', 'ABQ-2', 'LEGACY']);
    expect(rows[0]).toMatchObject({ prompt: 'Primera', answerLabel: '2', subscaleCode: null });
    expect(rows[1]).toMatchObject({ prompt: 'Segunda', answerLabel: 'Casi siempre', rawValue: '5', subscaleCode: 'sport_devaluation', isReverseScored: true });
    expect(rows[2]).toMatchObject({ prompt: null, answerLabel: '3' });
  });
});

describe('assessmentStage', () => {
  it('puts under-review assessments in the pending-grading stage', () => {
    expect(assessmentStage({ status: 'under_review', published: false })).toBe('pending');
    expect(assessmentStage({ status: 'approved', published: false })).toBe('approved');
    expect(assessmentStage({ status: 'approved', published: true })).toBe('published');
  });
});

describe('filterAthleteOptions', () => {
  const athletes = [
    { id: '1', label: 'José Martínez López' },
    { id: '2', label: 'Ana López' },
    { id: '3', label: 'Mario Ruiz' },
  ];

  it('matches as letters are typed, ignoring case and accents', () => {
    expect(filterAthleteOptions(athletes, 'jo').map((a) => a.id)).toEqual(['1']);
    expect(filterAthleteOptions(athletes, 'LOPEZ').map((a) => a.id)).toEqual(['1', '2']);
    expect(filterAthleteOptions(athletes, 'mart')).toHaveLength(1);
  });

  it('requires every typed word, in any order, and returns all on an empty search', () => {
    expect(filterAthleteOptions(athletes, 'lopez ana').map((a) => a.id)).toEqual(['2']);
    expect(filterAthleteOptions(athletes, '  ')).toHaveLength(3);
    expect(filterAthleteOptions(athletes, 'zzz')).toEqual([]);
  });
});

describe('assessmentDeadline', () => {
  const generated = '2026-10-10T15:00:00.000Z';

  it(`gives ${PSYCH_COMPLETION_WINDOW_DAYS} days from the generation date`, () => {
    const deadline = assessmentDeadline(generated, null, new Date('2026-10-11T15:00:00.000Z'));
    expect(deadline.dueAt.toISOString()).toBe('2026-10-15T15:00:00.000Z');
    expect(deadline).toMatchObject({ isOpen: true, isOverdue: false, daysLeft: 4 });
  });

  it('starts the window when a future-scheduled assessment opens', () => {
    const deadline = assessmentDeadline(generated, '2026-10-20T15:00:00.000Z', new Date('2026-10-12T15:00:00.000Z'));
    expect(deadline.isOpen).toBe(false);
    expect(deadline.dueAt.toISOString()).toBe('2026-10-25T15:00:00.000Z');
  });

  it('reports the last day and overdue assessments', () => {
    expect(assessmentDeadline(generated, null, new Date('2026-10-15T10:00:00.000Z')).daysLeft).toBe(0);
    expect(assessmentDeadline(generated, null, new Date('2026-10-16T16:00:00.000Z'))).toMatchObject({ isOverdue: true });
  });
});
