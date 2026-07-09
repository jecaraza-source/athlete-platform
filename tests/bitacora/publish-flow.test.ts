/**
 * =============================================================================
 * tests/bitacora/publish-flow.test.ts
 *
 * End-to-end test of the complete 6-step magazine publication flow.
 *
 * Tests cover:
 *   A. Stepper step computation — all state transitions via computePublishSteps()
 *   B. approveNarrative / rejectNarrative server actions
 *   C. narrative_status returned by getAdminActivities (admin list column)
 *   D. generate-narrative API eligibility guard (duplicates quick smoke-test
 *      from narrative.test.ts to ensure the guard is exercised in flow context)
 *
 * The vitest environment is Node (no DOM). React Server Components are tested
 * via the pure computePublishSteps() function; client components are covered
 * through their underlying server-action helpers.
 * =============================================================================
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ActivityStatus } from '@/lib/types/bitacora';

// =============================================================================
// Top-level mock setup (vi.mock is hoisted — all deps must live at module scope)
// =============================================================================

// Section D: Anthropic SDK mock
const mockFinalMsgD = vi.fn().mockResolvedValue({
  content: [{ type: 'text', text: 'Narrativa generada.' }],
});
const mockStreamD = vi.fn().mockResolvedValue({ finalMessage: mockFinalMsgD });

class MockAnthropicD {
  messages = { stream: mockStreamD };
  constructor(_?: unknown) {}
}

vi.mock('@anthropic-ai/sdk', () => ({ default: MockAnthropicD }));
vi.mock('@/lib/storage-config', () => ({
  getHeroUrl: vi.fn().mockReturnValue('https://example.com/img.jpg'),
  getThumbnailUrl: vi.fn().mockReturnValue('https://example.com/thumb.jpg'),
}));

// =============================================================================
// Shared fixtures
// =============================================================================

/** Minimal base activity data — every scenario starts from this. */
const BASE_ACTIVITY = {
  status:             'borrador'  as ActivityStatus,
  editorial_eligible: true,
  photos:             [] as Array<{ id: string; activity_id: string; storage_path: string; caption: null; display_order: number; alt_text: string; featured: boolean; created_at: string }>,
  narrative:          null as null | {
    id:             string;
    activity_id:    string;
    narrative_text: string;
    model_used:     string;
    status:         'borrador' | 'aprobado' | 'rechazado';
    generated_at:   string;
    approved_by:    null;
    approved_at:    null | string;
  },
};

function makePhoto(featured = false) {
  return {
    id:            'photo-1',
    activity_id:   'act-1',
    storage_path:  'act-1/photo.jpg',
    caption:       null as null,
    display_order: 0,
    alt_text:      'Foto evento',
    featured,
    created_at:    '2026-07-01T00:00:00Z',
  };
}

function makeNarrative(status: 'borrador' | 'aprobado' | 'rechazado') {
  return {
    id:             'narr-1',
    activity_id:    'act-1',
    narrative_text: 'Gran evento deportivo...',
    model_used:     'claude-opus-4-7',
    status,
    generated_at:   '2026-07-01T10:00:00Z',
    approved_by:    null as null,
    approved_at:    status === 'aprobado' ? '2026-07-01T11:00:00Z' : null as null,
  };
}

// =============================================================================
// A. Stepper step computation — computePublishSteps
// =============================================================================

describe('computePublishSteps — 6-step publication flow', () => {
  // We import the pure function directly — no mocking needed
  const locale = 'es';

  async function getSteps(overrides: Partial<typeof BASE_ACTIVITY>) {
    const { computePublishSteps } = await import('@/lib/bitacora/stepper-logic');
    return computePublishSteps({ ...BASE_ACTIVITY, ...overrides }, locale);
  }

  // ── Step 1: Actividad creada ──────────────────────────────────────────────

  it('step 1 is always done', async () => {
    const steps = await getSteps({});
    expect(steps[0].state).toBe('done');
    expect(steps[0].sublabel).toBe('creada');
  });

  // ── Step 2: Fotos ─────────────────────────────────────────────────────────

  it('step 2 active when no photos uploaded', async () => {
    const steps = await getSteps({ photos: [] });
    expect(steps[1].state).toBe('active');
    expect(steps[1].sublabel).toBe('Sin fotos');
  });

  it('step 2 active when photos exist but no cover marked', async () => {
    const steps = await getSteps({ photos: [makePhoto(false)] });
    expect(steps[1].state).toBe('active');
    expect(steps[1].sublabel).toBe('Marca una portada');
  });

  it('step 2 done when a photo is marked as featured (★)', async () => {
    const steps = await getSteps({ photos: [makePhoto(true)] });
    expect(steps[1].state).toBe('done');
    expect(steps[1].sublabel).toBe('★ Portada lista');
  });

  // ── Step 3: Publicar ──────────────────────────────────────────────────────

  it('step 3 locked when no cover photo exists', async () => {
    const steps = await getSteps({ photos: [] });
    expect(steps[2].state).toBe('locked');
  });

  it('step 3 active when cover exists but activity is still a draft', async () => {
    const steps = await getSteps({ photos: [makePhoto(true)], status: 'borrador' });
    expect(steps[2].state).toBe('active');
  });

  it('step 3 done when activity is published', async () => {
    const steps = await getSteps({ photos: [makePhoto(true)], status: 'publicado' });
    expect(steps[2].state).toBe('done');
  });

  // ── Step 4: Narrativa generada ────────────────────────────────────────────

  it('step 4 locked when activity is not published', async () => {
    const steps = await getSteps({ status: 'borrador', photos: [makePhoto(true)] });
    expect(steps[3].state).toBe('locked');
  });

  it('step 4 locked when activity is not editorial_eligible', async () => {
    const steps = await getSteps({
      status:             'publicado',
      editorial_eligible: false,
      photos:             [makePhoto(true)],
    });
    expect(steps[3].state).toBe('locked');
    expect(steps[3].sublabel).toBe('No elegible');
  });

  it('step 4 active when published + eligible but no narrative yet', async () => {
    const steps = await getSteps({
      status:   'publicado',
      photos:   [makePhoto(true)],
      narrative: null,
    });
    expect(steps[3].state).toBe('active');
    expect(steps[3].sublabel).toBeUndefined();
  });

  it('step 4 done when narrative is in borrador state', async () => {
    const steps = await getSteps({
      status:   'publicado',
      photos:   [makePhoto(true)],
      narrative: makeNarrative('borrador'),
    });
    expect(steps[3].state).toBe('done');
    expect(steps[3].sublabel).toBe('generada');
  });

  it('step 4 done when narrative is approved', async () => {
    const steps = await getSteps({
      status:   'publicado',
      photos:   [makePhoto(true)],
      narrative: makeNarrative('aprobado'),
    });
    expect(steps[3].state).toBe('done');
  });

  it('step 4 active (needs regeneration) when narrative is rechazado', async () => {
    const steps = await getSteps({
      status:   'publicado',
      photos:   [makePhoto(true)],
      narrative: makeNarrative('rechazado'),
    });
    expect(steps[3].state).toBe('active');
    expect(steps[3].sublabel).toBe('↺ Regenerar');
  });

  // ── Step 5: Aprobar narrativa ─────────────────────────────────────────────

  it('step 5 locked when no narrative exists', async () => {
    const steps = await getSteps({ status: 'publicado', narrative: null });
    expect(steps[4].state).toBe('locked');
  });

  it('step 5 locked when narrative is rechazado', async () => {
    const steps = await getSteps({
      status:    'publicado',
      photos:    [makePhoto(true)],
      narrative: makeNarrative('rechazado'),
    });
    expect(steps[4].state).toBe('locked');
  });

  it('step 5 active when narrative is borrador (pending approval)', async () => {
    const steps = await getSteps({
      status:   'publicado',
      photos:   [makePhoto(true)],
      narrative: makeNarrative('borrador'),
    });
    expect(steps[4].state).toBe('active');
  });

  it('step 5 done when narrative is approved', async () => {
    const steps = await getSteps({
      status:   'publicado',
      photos:   [makePhoto(true)],
      narrative: makeNarrative('aprobado'),
    });
    expect(steps[4].state).toBe('done');
  });

  // ── Step 6: Visible en Revista ────────────────────────────────────────────

  it('step 6 locked when narrative is not approved', async () => {
    const steps = await getSteps({
      status:   'publicado',
      photos:   [makePhoto(true)],
      narrative: makeNarrative('borrador'),
    });
    expect(steps[5].state).toBe('locked');
    expect(steps[5].href).toBeUndefined();
  });

  it('step 6 done + href set when narrative is approved', async () => {
    const steps = await getSteps({
      status:   'publicado',
      photos:   [makePhoto(true)],
      narrative: makeNarrative('aprobado'),
    });
    expect(steps[5].state).toBe('done');
    expect(steps[5].href).toBe('/es/revista/narr-1');
    expect(steps[5].sublabel).toBe('Ver artículo →');
  });

  // ── Full flow: 6/6 completados ────────────────────────────────────────────

  it('all 6 steps done on fully approved article', async () => {
    const steps = await getSteps({
      status:   'publicado',
      photos:   [makePhoto(true)],
      narrative: makeNarrative('aprobado'),
    });
    const doneCount = steps.filter((s) => s.state === 'done').length;
    expect(doneCount).toBe(6);
  });

  // ── Edge cases ────────────────────────────────────────────────────────────

  it('consulta non-eligible: step 4 locked even if published', async () => {
    const steps = await getSteps({
      status:             'publicado',
      editorial_eligible: false,
      photos:             [makePhoto(true)],
    });
    expect(steps[3].state).toBe('locked');
    expect(steps[4].state).toBe('locked');
    expect(steps[5].state).toBe('locked');
  });

  it('only 1 step done on brand-new draft with no photos', async () => {
    const steps = await getSteps({});
    const doneCount = steps.filter((s) => s.state === 'done').length;
    expect(doneCount).toBe(1);
    expect(steps[0].state).toBe('done');  // step 1
    expect(steps[1].state).toBe('active'); // step 2 (next action)
    expect(steps[2].state).toBe('locked');
    expect(steps[3].state).toBe('locked');
    expect(steps[4].state).toBe('locked');
    expect(steps[5].state).toBe('locked');
  });

  it('returns exactly 6 steps', async () => {
    const steps = await getSteps({});
    expect(steps).toHaveLength(6);
    expect(steps.map((s) => s.id)).toEqual([1, 2, 3, 4, 5, 6]);
  });
});

// =============================================================================
// B. approveNarrative / rejectNarrative server actions
// =============================================================================

const mockNarrativeUpdate = vi.fn();
const mockNarrativeEq     = vi.fn();

const narrativeFrom = vi.fn(() => ({
  update:      mockNarrativeUpdate.mockReturnThis(),
  insert:      vi.fn().mockReturnThis(),
  delete:      vi.fn().mockReturnThis(),
  select:      vi.fn().mockReturnThis(),
  eq:          mockNarrativeEq.mockReturnThis(),
  upsert:      vi.fn().mockReturnThis(),
  single:      vi.fn().mockResolvedValue({ data: null, error: null }),
  maybeSingle: vi.fn().mockResolvedValue({ data: null }),
}));

vi.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: {
    from:    narrativeFrom,
    storage: { from: vi.fn(() => ({ remove: vi.fn().mockResolvedValue({ error: null }) })) },
  },
}));

vi.mock('@/lib/rbac/server', () => ({
  assertAdminAccess: vi.fn().mockResolvedValue(null),
  getAuthUser:       vi.fn().mockResolvedValue({ id: 'admin-uuid' }),
}));

vi.mock('@/lib/bitacora/notifications', () => ({
  notifyActivityPublished:      vi.fn().mockResolvedValue(undefined),
  notifyMagazineIssuePublished: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

describe('approveNarrative', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls update with status=aprobado', async () => {
    narrativeFrom.mockImplementationOnce(() => ({
      update:      vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
      insert:      vi.fn().mockReturnThis(),
      select:      vi.fn().mockReturnThis(),
      eq:          vi.fn().mockReturnThis(),
      delete:      vi.fn().mockReturnThis(),
      upsert:      vi.fn().mockReturnThis(),
      single:      vi.fn().mockResolvedValue({ data: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null }),
    }));

    const { approveNarrative } = await import('@/lib/bitacora/actions');
    const result = await approveNarrative('narr-1');
    expect(result.error).toBe(null);
  });

  it('returns error when db update fails', async () => {
    narrativeFrom.mockImplementationOnce(() => ({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: { message: 'DB error' } }),
      }),
      insert:      vi.fn().mockReturnThis(),
      select:      vi.fn().mockReturnThis(),
      eq:          vi.fn().mockReturnThis(),
      delete:      vi.fn().mockReturnThis(),
      upsert:      vi.fn().mockReturnThis(),
      single:      vi.fn().mockResolvedValue({ data: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null }),
    }));

    const { approveNarrative } = await import('@/lib/bitacora/actions');
    const result = await approveNarrative('narr-1');
    expect(result.error).not.toBe(null);
  });
});

describe('rejectNarrative', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls update with status=rechazado', async () => {
    narrativeFrom.mockImplementationOnce(() => ({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
      insert:      vi.fn().mockReturnThis(),
      select:      vi.fn().mockReturnThis(),
      eq:          vi.fn().mockReturnThis(),
      delete:      vi.fn().mockReturnThis(),
      upsert:      vi.fn().mockReturnThis(),
      single:      vi.fn().mockResolvedValue({ data: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null }),
    }));

    const { rejectNarrative } = await import('@/lib/bitacora/actions');
    const result = await rejectNarrative('narr-1');
    expect(result.error).toBe(null);
  });
});

// =============================================================================
// C. narrative_status in getAdminActivities (admin list)
// =============================================================================

describe('getAdminActivities — narrative_status field', () => {
  const ACT_ID = 'act-uuid-1';

  function buildAdminMock(narrativeStatus: string | null) {
    // Cast to any: this mock returns different shapes per table (polymorphic)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (narrativeFrom as any).mockImplementation((table: string) => {
      if (table === 'activities') {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              eq:    vi.fn().mockReturnThis(),
              range: vi.fn().mockResolvedValue({
                data:  [{ id: ACT_ID, type: 'evento_deportivo', title: 'Test', slug: 'test',
                           description: null, event_date: null, location: null, tags: [],
                           status: 'publicado', editorial_eligible: true,
                           created_by: null, notified_at: null,
                           created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' }],
                count: 1,
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'activity_photos') {
        return { select: vi.fn().mockReturnValue({ in: vi.fn().mockResolvedValue({ data: [], error: null }) }) };
      }
      if (table === 'activity_comments') {
        return { select: vi.fn().mockReturnValue({ in: vi.fn().mockResolvedValue({ data: [], error: null }) }) };
      }
      if (table === 'activity_narratives') {
        const narrativeData = narrativeStatus
          ? [{ activity_id: ACT_ID, status: narrativeStatus }]
          : [];
        return { select: vi.fn().mockReturnValue({ in: vi.fn().mockResolvedValue({ data: narrativeData, error: null }) }) };
      }
      return { select: vi.fn().mockReturnValue({ in: vi.fn().mockResolvedValue({ data: [] }) }) };
    });
  }

  beforeEach(() => vi.clearAllMocks());

  it('narrative_status is null when no narrative exists', async () => {
    buildAdminMock(null);
    const { getAdminActivities } = await import('@/lib/bitacora/queries');
    const { activities } = await getAdminActivities();
    expect(activities[0].narrative_status).toBe(null);
    expect(activities[0].has_narrative).toBe(false);
  });

  it('narrative_status is "borrador" for a draft narrative', async () => {
    buildAdminMock('borrador');
    const { getAdminActivities } = await import('@/lib/bitacora/queries');
    const { activities } = await getAdminActivities();
    expect(activities[0].narrative_status).toBe('borrador');
    expect(activities[0].has_narrative).toBe(true);
  });

  it('narrative_status is "aprobado" for an approved narrative', async () => {
    buildAdminMock('aprobado');
    const { getAdminActivities } = await import('@/lib/bitacora/queries');
    const { activities } = await getAdminActivities();
    expect(activities[0].narrative_status).toBe('aprobado');
    expect(activities[0].has_narrative).toBe(true);
  });

  it('narrative_status is "rechazado" for a rejected narrative', async () => {
    buildAdminMock('rechazado');
    const { getAdminActivities } = await import('@/lib/bitacora/queries');
    const { activities } = await getAdminActivities();
    expect(activities[0].narrative_status).toBe('rechazado');
    expect(activities[0].has_narrative).toBe(true);
  });
});

// =============================================================================
// D. generate-narrative eligibility guard (smoke test in flow context)
// Mocks live at module top level (MockAnthropicD, mockFinalMsgD, etc.)
// =============================================================================

function makeBaseActivity(overrides: object) {
  return {
    id: 'act-1', type: 'evento_deportivo' as const, title: 'Test',
    slug: 'test', description: null, event_date: null, location: null,
    tags: [], status: 'publicado' as const, editorial_eligible: true,
    created_by: null, notified_at: null,
    created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
    photos: [], narrative: null, comments: [],
    ...overrides,
  };
}

describe('generate-narrative eligibility guard', () => {
  it('throws when editorial_eligible is false', async () => {
    const { generateNarrative } = await import('@/lib/bitacora/narrative');
    await expect(
      generateNarrative({ activity: makeBaseActivity({ editorial_eligible: false }) })
    ).rejects.toThrow('no es elegible para narrativa editorial');
  });

  it('succeeds for a published eligible activity', async () => {
    const { generateNarrative } = await import('@/lib/bitacora/narrative');
    const result = await generateNarrative({ activity: makeBaseActivity({}) });
    expect(result.narrative_text).toBe('Narrativa generada.');
    expect(typeof result.model_used).toBe('string');
  });
});
