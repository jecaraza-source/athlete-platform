import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockInsert  = vi.fn();
const mockUpdate  = vi.fn();
const mockDelete  = vi.fn();
const mockSelect  = vi.fn();
const mockSingle  = vi.fn();
const mockMaybe   = vi.fn();

const mockFrom = vi.fn(() => ({
  insert:     mockInsert.mockReturnThis(),
  update:     mockUpdate.mockReturnThis(),
  delete:     mockDelete.mockReturnThis(),
  select:     mockSelect.mockReturnThis(),
  eq:         vi.fn().mockReturnThis(),
  upsert:     vi.fn().mockReturnThis(),
  single:     mockSingle,
  maybeSingle: mockMaybe,
}));

vi.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: {
    from:    mockFrom,
    storage: {
      from: vi.fn(() => ({
        remove: vi.fn().mockResolvedValue({ error: null }),
      })),
    },
  },
}));

vi.mock('@/lib/rbac/server', () => ({
  assertAdminAccess: vi.fn().mockResolvedValue(null),
  getAuthUser:       vi.fn().mockResolvedValue({ id: 'user-uuid' }),
}));

vi.mock('@/lib/bitacora/notifications', () => ({
  notifyActivityPublished:      vi.fn().mockResolvedValue(undefined),
  notifyMagazineIssuePublished: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('submitComment', () => {
  it('should reject empty author_name', async () => {
    const { submitComment } = await import('@/lib/bitacora/actions');
    const result = await submitComment({
      activity_id: 'act-1',
      author_name: '  ',
      comment:     'Buen evento',
    });
    expect(result.error).toBe('El nombre es requerido.');
  });

  it('should reject empty comment text', async () => {
    const { submitComment } = await import('@/lib/bitacora/actions');
    const result = await submitComment({
      activity_id: 'act-1',
      author_name: 'Juan',
      comment:     '',
    });
    expect(result.error).toBe('El comentario no puede estar vacío.');
  });

  it('should reject comments over 1000 chars', async () => {
    const { submitComment } = await import('@/lib/bitacora/actions');
    const result = await submitComment({
      activity_id: 'act-1',
      author_name: 'Juan',
      comment:     'x'.repeat(1001),
    });
    expect(result.error).toContain('demasiado largo');
  });

  it('should insert comment with approved=false on success', async () => {
    mockFrom.mockImplementationOnce(() => ({
      insert:     vi.fn().mockResolvedValue({ error: null }),
      select:     vi.fn().mockReturnThis(),
      eq:         vi.fn().mockReturnThis(),
      update:     vi.fn().mockReturnThis(),
      delete:     vi.fn().mockReturnThis(),
      upsert:     vi.fn().mockReturnThis(),
      single:     vi.fn().mockResolvedValue({ data: { id: 'c1' }, error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null }),
    }));

    const { submitComment } = await import('@/lib/bitacora/actions');
    const result = await submitComment({
      activity_id:  'act-1',
      author_name:  'Juan',
      comment:      'Excelente evento',
    });
    expect(result.error).toBe(null);
  });
});

describe('createActivity', () => {
  it('should deny non-admin access', async () => {
    const { assertAdminAccess } = await import('@/lib/rbac/server');
    vi.mocked(assertAdminAccess).mockResolvedValueOnce({ error: 'Admin access required.' });

    const { createActivity } = await import('@/lib/bitacora/actions');
    const result = await createActivity({
      type:  'evento_deportivo',
      title: 'Test event',
    });
    expect(result.error).toBe('Admin access required.');
  });
});

describe('moderateComment', () => {
  it('should update approved field', async () => {
    const updateMock = vi.fn().mockReturnThis();
    const eqMock     = vi.fn().mockResolvedValue({ error: null });

    mockFrom.mockImplementationOnce(() => ({
      insert:      vi.fn().mockReturnThis(),
      update:      updateMock,
      delete:      vi.fn().mockReturnThis(),
      select:      vi.fn().mockReturnThis(),
      eq:          eqMock,
      upsert:      vi.fn().mockReturnThis(),
      single:      vi.fn().mockResolvedValue({ data: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null }),
    }));

    const { moderateComment } = await import('@/lib/bitacora/actions');
    const result = await moderateComment('comment-1', true);
    expect(result.error).toBe(null);
  });
});
