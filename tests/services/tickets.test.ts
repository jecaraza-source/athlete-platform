/**
 * Unit tests for services/tickets.ts
 *
 * The Supabase client is fully mocked — no real DB connections are made.
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { makeChain } from '../helpers';

vi.mock('@/lib/supabase', () => ({
  supabase: { from: vi.fn() },
}));

import {
  listTickets,
  getTicket,
  createTicket,
  addComment,
  changeTicketStatus,
  countOpenTickets,
} from '@/services/tickets';
import { supabase } from '@/lib/supabase';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const TICKET_A = {
  id: 'tkt-001',
  title: 'Problema con el equipo',
  description: 'El cronómetro no funciona.',
  status: 'open',
  priority: 'medium',
  created_by: 'profile-001',
  assigned_to: null,
  due_date: null,
  requester_user_id: 'profile-001',
  created_at: '2024-06-01T10:00:00Z',
  updated_at: '2024-06-01T10:00:00Z',
  created_by_profile: { id: 'profile-001', first_name: 'Juan', last_name: 'Pérez', email: 'juan@example.com' },
  assigned_to_profile: null,
};

const COMMENT_A = {
  id: 'cmt-001',
  ticket_id: 'tkt-001',
  author_id: 'profile-002',
  message: 'Revisando el problema.',
  created_at: '2024-06-01T11:00:00Z',
  author: { id: 'profile-002', first_name: 'María', last_name: 'López', email: 'maria@example.com' },
};

beforeEach(() => vi.clearAllMocks());

// ===========================================================================
// listTickets
// ===========================================================================

describe('listTickets', () => {
  it('returns all tickets when no filters are provided (staff view)', async () => {
    vi.mocked(supabase.from).mockReturnValue(
      makeChain({ data: [TICKET_A], error: null }) as never
    );
    const result = await listTickets();
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('tkt-001');
  });

  it('filters by createdBy for athlete-role users', async () => {
    const chain = makeChain({ data: [TICKET_A], error: null });
    vi.mocked(supabase.from).mockReturnValue(chain as never);

    await listTickets({ createdBy: 'profile-001' });

    expect(chain.eq).toHaveBeenCalledWith('created_by', 'profile-001');
  });

  it('filters by status when provided', async () => {
    const chain = makeChain({ data: [], error: null });
    vi.mocked(supabase.from).mockReturnValue(chain as never);

    await listTickets({ status: 'open' });

    expect(chain.eq).toHaveBeenCalledWith('status', 'open');
  });

  it('filters by priority when provided', async () => {
    const chain = makeChain({ data: [], error: null });
    vi.mocked(supabase.from).mockReturnValue(chain as never);

    await listTickets({ priority: 'urgent' });

    expect(chain.eq).toHaveBeenCalledWith('priority', 'urgent');
  });

  it('throws when the DB returns an error', async () => {
    vi.mocked(supabase.from).mockReturnValue(
      makeChain({ data: null, error: { message: 'DB error', code: '500' } }) as never
    );
    await expect(listTickets()).rejects.toMatchObject({ message: 'DB error' });
  });
});

// ===========================================================================
// getTicket
// ===========================================================================

describe('getTicket', () => {
  it('returns the ticket when found', async () => {
    const chain = makeChain({ data: TICKET_A, error: null });
    vi.mocked(supabase.from).mockReturnValue(chain as never);

    const result = await getTicket('tkt-001');

    expect(result).toMatchObject({ id: 'tkt-001', status: 'open' });
    expect(chain.maybeSingle).toHaveBeenCalledOnce();
  });

  it('returns null when ticket does not exist', async () => {
    vi.mocked(supabase.from).mockReturnValue(
      makeChain({ data: null, error: null }) as never
    );
    expect(await getTicket('nonexistent')).toBeNull();
  });
});

// ===========================================================================
// createTicket
// ===========================================================================

describe('createTicket', () => {
  it('inserts a ticket and returns the created row', async () => {
    const newTicket = { ...TICKET_A, id: 'tkt-new' };
    const chain = makeChain({ data: newTicket, error: null });
    vi.mocked(supabase.from).mockReturnValue(chain as never);

    const result = await createTicket({
      title: 'Nuevo problema',
      description: 'Descripción.',
      priority: 'high',
      created_by: 'profile-001',
    });

    expect(result.id).toBe('tkt-new');
    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Nuevo problema', status: 'open' })
    );
    expect(chain.single).toHaveBeenCalledOnce();
  });

  it('throws when the DB insert fails', async () => {
    vi.mocked(supabase.from).mockReturnValue(
      makeChain({ data: null, error: { message: 'insert failed' } }) as never
    );
    await expect(
      createTicket({ title: 'x', description: 'y', priority: 'low', created_by: 'p1' })
    ).rejects.toMatchObject({ message: 'insert failed' });
  });
});

// ===========================================================================
// addComment
// ===========================================================================

describe('addComment', () => {
  it('inserts a comment row without error', async () => {
    const chain = makeChain({ data: null, error: null });
    vi.mocked(supabase.from).mockReturnValue(chain as never);

    await expect(
      addComment('tkt-001', 'profile-002', 'Comentario de prueba')
    ).resolves.toBeUndefined();

    expect(chain.insert).toHaveBeenCalledWith({
      ticket_id: 'tkt-001',
      author_id: 'profile-002',
      message: 'Comentario de prueba',
    });
  });

  it('throws when the insert fails', async () => {
    vi.mocked(supabase.from).mockReturnValue(
      makeChain({ data: null, error: { message: 'insert failed' } }) as never
    );
    await expect(addComment('tkt-001', 'p1', 'msg')).rejects.toMatchObject({
      message: 'insert failed',
    });
  });
});

// ===========================================================================
// changeTicketStatus
// ===========================================================================

describe('changeTicketStatus', () => {
  it('calls update with the new status', async () => {
    const chain = makeChain({ data: null, error: null });
    vi.mocked(supabase.from).mockReturnValue(chain as never);

    await changeTicketStatus('tkt-001', 'resolved');

    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'resolved' })
    );
    expect(chain.eq).toHaveBeenCalledWith('id', 'tkt-001');
  });
});

// ===========================================================================
// countOpenTickets
// ===========================================================================

describe('countOpenTickets', () => {
  it('returns the count of open tickets', async () => {
    vi.mocked(supabase.from).mockReturnValue(
      makeChain({ count: 7, error: null }) as never
    );
    expect(await countOpenTickets()).toBe(7);
  });

  it('returns 0 when count is null', async () => {
    vi.mocked(supabase.from).mockReturnValue(
      makeChain({ count: null, error: null }) as never
    );
    expect(await countOpenTickets()).toBe(0);
  });
});

// ===========================================================================
// getTicketComments  (smoke test — covered implicitly by addComment tests)
// ===========================================================================

describe('getTicketComments', () => {
  it('returns comments with author data', async () => {
    const { getTicketComments } = await import('@/services/tickets');
    vi.mocked(supabase.from).mockReturnValue(
      makeChain({ data: [COMMENT_A], error: null }) as never
    );
    const result = await getTicketComments('tkt-001');
    expect(result).toHaveLength(1);
    expect(result[0].message).toBe('Revisando el problema.');
  });
});
