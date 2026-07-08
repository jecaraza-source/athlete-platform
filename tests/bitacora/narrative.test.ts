import { describe, it, expect, vi } from 'vitest';
import { slugify } from '@/lib/bitacora/slug-utils';

// ---------------------------------------------------------------------------
// Tests de slug-utils (sin necesidad de mock)
// ---------------------------------------------------------------------------

describe('slugify', () => {
  it('converts spaces to hyphens', () => {
    expect(slugify('Torneo Nacional')).toBe('torneo-nacional');
  });

  it('removes diacritics', () => {
    expect(slugify('Año Deportivo')).toBe('ano-deportivo');
    expect(slugify('Competición de Fútbol')).toBe('competicion-de-futbol');
  });

  it('handles multiple spaces and special characters', () => {
    expect(slugify('  Evento   2026!  ')).toBe('evento-2026');
  });

  it('truncates to 80 characters', () => {
    const long = 'a'.repeat(100);
    expect(slugify(long).length).toBeLessThanOrEqual(80);
  });

  it('lowercases the string', () => {
    expect(slugify('TORNEO NACIONAL')).toBe('torneo-nacional');
  });
});

// ---------------------------------------------------------------------------
// Tests de narrativa — validación de guarda de privacidad
// ---------------------------------------------------------------------------

const mockFinalMessage = vi.fn().mockResolvedValue({
  content: [{ type: 'text', text: 'Narrativa de prueba generada por el modelo.' }],
});
const mockStream = vi.fn().mockResolvedValue({ finalMessage: mockFinalMessage });

class MockAnthropic {
  messages = { stream: mockStream };
  constructor(_opts?: unknown) {}
}

vi.mock('@anthropic-ai/sdk', () => ({
  default: MockAnthropic,
}));

vi.mock('@/lib/storage-config', () => ({
  getHeroUrl: vi.fn().mockReturnValue('https://example.com/photo.jpg'),
}));

describe('generateNarrative privacy guard', () => {
  it('throws when activity is not editorial_eligible', async () => {
    const { generateNarrative } = await import('@/lib/bitacora/narrative');

    const ineligibleActivity = {
      id:                 'act-1',
      type:               'consulta' as const,
      title:              'Consulta médica',
      slug:               'consulta-medica',
      description:        null,
      event_date:         null,
      location:           null,
      tags:               [],
      status:             'publicado' as const,
      editorial_eligible: false,   // ← NO elegible
      created_by:         null,
      notified_at:        null,
      created_at:         new Date().toISOString(),
      updated_at:         new Date().toISOString(),
      photos:             [],
      narrative:          null,
      comments:           [],
    };

    await expect(generateNarrative({ activity: ineligibleActivity })).rejects.toThrow(
      'no es elegible para narrativa editorial'
    );
  });

  it('generates narrative for eligible activity', async () => {
    const { generateNarrative } = await import('@/lib/bitacora/narrative');

    const eligibleActivity = {
      id:                 'act-2',
      type:               'evento_deportivo' as const,
      title:              'Torneo Nacional',
      slug:               'torneo-nacional',
      description:        'Gran torneo de taekwondo.',
      event_date:         '2026-07-15',
      location:           'Ciudad de México',
      tags:               ['taekwondo', 'competencia'],
      status:             'publicado' as const,
      editorial_eligible: true,
      created_by:         null,
      notified_at:        null,
      created_at:         new Date().toISOString(),
      updated_at:         new Date().toISOString(),
      photos:             [],
      narrative:          null,
      comments:           [],
    };

    const result = await generateNarrative({ activity: eligibleActivity });
    expect(result.narrative_text).toBe('Narrativa de prueba generada por el modelo.');
    expect(result.model_used).toBe('claude-opus-4-7');
  });
});
