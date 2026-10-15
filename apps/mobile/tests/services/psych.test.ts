import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: { getSession: vi.fn() },
    rpc: vi.fn(),
  },
}));

import { getPsychOverview, listPsychologicalHistory } from '@/services/psych';
import { supabase } from '@/lib/supabase';
import { daysLeftLabel, instrumentAbout, subscaleLabel } from '@/lib/psych-labels';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: { access_token: 'athlete-token' } } } as never);
});

describe('getPsychOverview', () => {
  it('calls the athlete overview API with the session token', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        completionWindowDays: 5,
        pending: [{ id: 'a-1', instrumentName: 'ABQ', createdAt: '2026-10-10T15:00:00Z', opensAt: '2026-10-10T15:00:00Z', dueAt: '2026-10-15T15:00:00Z', isOpen: true, daysLeft: 3, isOverdue: false }],
        answered: [{ id: 'a-2', instrumentName: 'SMTQ', completedAt: '2026-10-09T15:00:00Z' }],
        results: [],
      }),
    });

    const overview = await getPsychOverview();

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/psych\/me$/),
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer athlete-token' }) }),
    );
    expect(overview.pending).toHaveLength(1);
    expect(overview.answered[0].instrumentName).toBe('SMTQ');
  });

  it('tolerates missing lists and surfaces API errors', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({}) });
    await expect(getPsychOverview()).resolves.toEqual({ completionWindowDays: 5, pending: [], answered: [], results: [] });

    fetchMock.mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({ error: 'Falló' }) });
    await expect(getPsychOverview()).rejects.toThrow('Falló');
  });
});

describe('psych labels', () => {
  it('describes known tests and labels subscales', () => {
    expect(instrumentAbout('ABQ')).toMatch(/agotamiento/);
    expect(instrumentAbout('UNKNOWN')).toBeNull();
    expect(subscaleLabel('sport_devaluation')).toBe('Devaluación del deporte');
    expect(subscaleLabel('new_area')).toBe('new area');
  });

  it('words the remaining days', () => {
    expect(daysLeftLabel(0)).toBe('Vence hoy');
    expect(daysLeftLabel(1)).toBe('Queda 1 día');
    expect(daysLeftLabel(4)).toBe('Quedan 4 días');
  });
});

describe('listPsychologicalHistory', () => {
  it('maps only the published clinical-summary contract returned by the RPC', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: [{
        id: 'assessment-001',
        completed_at: '2026-10-05T10:00:00Z',
        instrument_name: 'SCAT',
        clinical_summary: 'El equipo recomienda seguimiento durante la competencia.',
      }],
      error: null,
    } as never);

    await expect(listPsychologicalHistory()).resolves.toEqual([{
      id: 'assessment-001',
      completedAt: '2026-10-05T10:00:00Z',
      instrumentName: 'SCAT',
      clinicalSummary: 'El equipo recomienda seguimiento durante la competencia.',
    }]);
    expect(supabase.rpc).toHaveBeenCalledWith('get_published_psychological_history');
  });

  it('throws when the protected published-history RPC fails', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: null,
      error: { message: 'RPC failed' },
    } as never);

    await expect(listPsychologicalHistory()).rejects.toThrow('RPC failed');
  });
});
