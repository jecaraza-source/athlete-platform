/**
 * Minimal chainable stand-in for the Supabase query builder used by the psych
 * tests. Every builder method is recorded and returns the builder; awaiting
 * the builder (or calling maybeSingle/single) resolves through `resolve`,
 * which receives the table and the recorded calls for that query.
 */

export type RecordedCall = { method: string; args: unknown[] };
export type RecordedQuery = { table: string; calls: RecordedCall[] };
export type QueryResult = { data?: unknown; error?: unknown; count?: number | null };

export function createSupabaseChain(
  resolve: (query: RecordedQuery) => QueryResult,
) {
  const queries: RecordedQuery[] = [];

  function from(table: string) {
    const query: RecordedQuery = { table, calls: [] };
    queries.push(query);
    const settle = () => Promise.resolve({ data: null, error: null, ...resolve(query) });
    const builder: Record<string, unknown> = {
      then: (onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) =>
        settle().then(onFulfilled, onRejected),
      maybeSingle: () => {
        query.calls.push({ method: 'maybeSingle', args: [] });
        return settle();
      },
      single: () => {
        query.calls.push({ method: 'single', args: [] });
        return settle();
      },
    };
    const proxy: unknown = new Proxy(builder, {
      get(target, property: string) {
        if (property in target) return target[property];
        return (...args: unknown[]) => {
          query.calls.push({ method: property, args });
          return proxy;
        };
      },
    });
    return proxy;
  }

  return { from, queries };
}

export function hasCall(query: RecordedQuery, method: string, ...args: unknown[]) {
  return query.calls.some((call) =>
    call.method === method && args.every((arg, index) => JSON.stringify(call.args[index]) === JSON.stringify(arg)),
  );
}
