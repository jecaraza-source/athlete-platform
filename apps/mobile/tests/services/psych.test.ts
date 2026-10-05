import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: { getSession: vi.fn() },
    rpc: vi.fn(),
  },
}));

import { listPsychologicalHistory } from '@/services/psych';
import { supabase } from '@/lib/supabase';

beforeEach(() => vi.clearAllMocks());

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
