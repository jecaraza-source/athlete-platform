import { describe, it, expect } from 'vitest';
import { calculateNextOccurrence } from '@/lib/notifications/scheduler';

const BASE = '2026-04-12T10:00:00.000Z';

describe('calculateNextOccurrence', () => {
  it('returns null for recurrence=none', () => {
    expect(calculateNextOccurrence(BASE, 'none')).toBeNull();
  });

  it('adds 1 day for daily recurrence', () => {
    const result = calculateNextOccurrence(BASE, 'daily');
    expect(result).toBe('2026-04-13T10:00:00.000Z');
  });

  it('adds 7 days for weekly recurrence', () => {
    const result = calculateNextOccurrence(BASE, 'weekly');
    expect(result).toBe('2026-04-19T10:00:00.000Z');
  });

  it('adds 1 month for monthly recurrence', () => {
    const result = calculateNextOccurrence(BASE, 'monthly');
    expect(result).toBe('2026-05-12T10:00:00.000Z');
  });

  it('handles monthly recurrence crossing year boundary', () => {
    const dec = '2026-12-01T00:00:00.000Z';
    const result = calculateNextOccurrence(dec, 'monthly');
    expect(result).toBe('2027-01-01T00:00:00.000Z');
  });

  it('uses interval_minutes for custom recurrence', () => {
    const result = calculateNextOccurrence(BASE, 'custom', { interval_minutes: 120 });
    // 10:00 + 120 min = 12:00
    expect(result).toBe('2026-04-12T12:00:00.000Z');
  });

  it('defaults custom interval to 60 minutes when not specified', () => {
    const result = calculateNextOccurrence(BASE, 'custom', {});
    // 10:00 + 60 min = 11:00
    expect(result).toBe('2026-04-12T11:00:00.000Z');
  });
});
