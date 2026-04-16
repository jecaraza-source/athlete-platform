/**
 * tests/helpers.ts — Shared test utilities for the mobile unit test suite.
 *
 * makeChain(result)
 * -----------------
 * Creates a chainable Supabase query mock that can be directly awaited.
 *
 * The Supabase JS client uses a fluent builder pattern where every query
 * method returns `this`, deferring DB execution until the chain is awaited.
 * This helper replicates that pattern:
 *
 *   • All builder methods (select, order, eq, …) return `this` via mockReturnThis().
 *   • Terminal methods (maybeSingle, single) return mockResolvedValue(result).
 *   • The chain itself is thenable so `await chain` resolves to `result`
 *     — covering queries that don't end with an explicit terminal call.
 *
 * Usage:
 *   vi.mocked(supabase.from).mockReturnValue(makeChain({ data: [...], error: null }) as any);
 *   vi.mocked(supabase.from).mockImplementation((table) => {
 *     if (table === 'profiles') return makeChain({ data: profileRow, error: null }) as any;
 *     return makeChain({ data: [], error: null }) as any;
 *   });
 */

import { vi } from 'vitest';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyResult = Record<string, any>;

export function makeChain(result: AnyResult) {
  const chain = {
    // ── Builder methods — each returns `this` (the chain object) ───────────
    select:      vi.fn().mockReturnThis(),
    order:       vi.fn().mockReturnThis(),
    range:       vi.fn().mockReturnThis(),
    limit:       vi.fn().mockReturnThis(),
    eq:          vi.fn().mockReturnThis(),
    neq:         vi.fn().mockReturnThis(),
    or:          vi.fn().mockReturnThis(),
    in:          vi.fn().mockReturnThis(),
    is:          vi.fn().mockReturnThis(),
    not:         vi.fn().mockReturnThis(),
    gte:         vi.fn().mockReturnThis(),
    lte:         vi.fn().mockReturnThis(),
    insert:      vi.fn().mockReturnThis(),
    update:      vi.fn().mockReturnThis(),
    upsert:      vi.fn().mockReturnThis(),
    delete:      vi.fn().mockReturnThis(),

    // ── Terminal methods — resolve with `result` ────────────────────────────
    maybeSingle: vi.fn().mockResolvedValue(result),
    single:      vi.fn().mockResolvedValue(result),

    // ── Thenable — allows `await chain` to resolve with `result` ───────────
    // JavaScript treats any object with a `.then` method as a Promise.
    // This is invoked when the query builder is directly awaited without
    // calling a terminal method (e.g. `const { data } = await supabase.from(...)...eq(...)`).
    then: (
      onFulfilled: ((v: AnyResult) => unknown) | null | undefined,
      onRejected?: ((e: unknown) => unknown) | null,
    ) => Promise.resolve(result).then(onFulfilled, onRejected ?? undefined),
  };

  return chain;
}
