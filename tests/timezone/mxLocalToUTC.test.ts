/**
 * Unit tests for the `mxLocalToUTC` timezone utility.
 *
 * mxLocalToUTC() converts a naive datetime-local string (no TZ suffix, as
 * produced by <input type="datetime-local">) from Mexico City local time to
 * a UTC ISO string.
 *
 * Since 2023, Mexico City (America/Mexico_City) no longer observes Daylight
 * Saving Time and remains on CST (UTC-6) year-round.
 * All conversions therefore add +6 hours regardless of month.
 */

import { describe, it, expect } from 'vitest';
import { mxLocalToUTC } from '@/lib/timezone';

// ---------------------------------------------------------------------------
// Year-round CST (UTC-6) — Mexico City abolished DST in 2023
// ---------------------------------------------------------------------------

describe('mxLocalToUTC — CST UTC-6 (year-round, all months)', () => {
  it('converts 06:30 MX on July 6 → 12:30Z UTC (+6 h)', () => {
    expect(mxLocalToUTC('2026-07-06T06:30')).toBe('2026-07-06T12:30:00.000Z');
  });

  it('converts 00:00 MX (midnight, July) → 06:00Z UTC', () => {
    expect(mxLocalToUTC('2026-07-06T00:00')).toBe('2026-07-06T06:00:00.000Z');
  });

  it('converts 18:00 MX (6 PM, July) → 00:00Z UTC next day', () => {
    expect(mxLocalToUTC('2026-07-06T18:00')).toBe('2026-07-07T00:00:00.000Z');
  });

  it('handles explicit seconds in the naive string', () => {
    expect(mxLocalToUTC('2026-07-06T06:30:00')).toBe('2026-07-06T12:30:00.000Z');
  });

  it('converts 08:00 MX on Jan 15 → 14:00Z UTC (+6 h)', () => {
    expect(mxLocalToUTC('2026-01-15T08:00')).toBe('2026-01-15T14:00:00.000Z');
  });

  it('converts 00:00 MX (midnight, January) → 06:00Z UTC', () => {
    expect(mxLocalToUTC('2026-01-15T00:00')).toBe('2026-01-15T06:00:00.000Z');
  });

  it('converts 20:00 MX (8 PM, January) → 02:00Z UTC next day', () => {
    expect(mxLocalToUTC('2026-01-15T20:00')).toBe('2026-01-16T02:00:00.000Z');
  });
});

// ---------------------------------------------------------------------------
// Pass-through cases (string already has timezone info)
// ---------------------------------------------------------------------------

describe('mxLocalToUTC — pass-through when TZ info is already present', () => {
  it('passes through a string ending with Z (returns normalised ISO)', () => {
    expect(mxLocalToUTC('2026-07-06T12:30:00.000Z')).toBe('2026-07-06T12:30:00.000Z');
  });

  it('normalises an explicit -06:00 offset to UTC', () => {
    // 06:30-06:00 = 12:30Z (same as naive 06:30 MX)
    expect(mxLocalToUTC('2026-07-06T06:30:00-06:00')).toBe('2026-07-06T12:30:00.000Z');
  });

  it('normalises a different explicit offset (-05:00) to UTC', () => {
    // 06:30-05:00 = 11:30Z
    expect(mxLocalToUTC('2026-07-06T06:30:00-05:00')).toBe('2026-07-06T11:30:00.000Z');
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('mxLocalToUTC — edge cases', () => {
  it('returns empty string unchanged', () => {
    expect(mxLocalToUTC('')).toBe('');
  });

  it('year boundary: Dec 31 23:00 MX → Jan 1 05:00Z UTC next year', () => {
    expect(mxLocalToUTC('2025-12-31T23:00')).toBe('2026-01-01T05:00:00.000Z');
  });
});
