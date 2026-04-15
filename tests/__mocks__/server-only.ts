// Empty stub — replaces the real "server-only" package in the Vitest Node
// environment. The real package throws an error when imported outside a
// Next.js Server Component; this stub does nothing, allowing server-side
// utilities to be tested in Node.js without that constraint.
export {};
