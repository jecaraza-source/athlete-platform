// =============================================================================
// lib/timezone.ts
// Central timezone utility for AO Deportes.
//
// All server-side date calculations and formatting must use this module so that
// dates/times consistently reflect Mexico City local time regardless of the
// UTC timezone used by the Vercel runtime.
//
// Timezone: America/Mexico_City
//   Standard: UTC-6 (CST)  — November through March
//   Summer:   UTC-5 (CDT)  — First Sunday of April through last Sunday of October
// =============================================================================

export const TZ = 'America/Mexico_City';

// ---------------------------------------------------------------------------
// Compute Mexico City wall-clock offset vs. UTC
// ---------------------------------------------------------------------------

/**
 * Returns the current offset between UTC and Mexico City in milliseconds.
 * Positive value means MX is behind UTC (e.g. UTC-6 → +21600000 ms).
 * Handles DST automatically because toLocaleString() always reflects the
 * actual offset at the given moment.
 */
function getMXOffsetMs(reference: Date = new Date()): number {
  // Parse the MX wall-clock string as if it were a "local" (UTC) date
  const mxWallStr = reference.toLocaleString('en-US', { timeZone: TZ });
  const mxWallMs  = new Date(mxWallStr).getTime();
  return reference.getTime() - mxWallMs;
}

// ---------------------------------------------------------------------------
// Core helpers
// ---------------------------------------------------------------------------

/**
 * Returns a Date whose *local* methods (getFullYear, getMonth, getDate,
 * getHours, …) return the current wall-clock values in Mexico City.
 *
 * Use this as a drop-in replacement for `new Date()` when calling date-fns
 * functions that rely on local time (startOfDay, startOfWeek, startOfMonth …).
 *
 * @example
 *   import { startOfDay } from 'date-fns';
 *   const today = startOfDay(nowInMX()); // midnight *MX* time
 */
export function nowInMX(): Date {
  const now = new Date();
  const offsetMs = getMXOffsetMs(now);
  // Shift the timestamp so that UTC methods return MX wall-clock values
  return new Date(now.getTime() - offsetMs);
}

/**
 * Converts any Date / ISO string to the equivalent "MX-local" Date.
 * Useful for passing timestamps from the DB (stored in UTC) to date-fns.
 */
export function toMXDate(date: Date | string): Date {
  const d = typeof date === 'string' ? new Date(date) : date;
  const offsetMs = getMXOffsetMs(d);
  return new Date(d.getTime() - offsetMs);
}

// ---------------------------------------------------------------------------
// Formatting helpers (server-safe: always use timeZone: TZ)
// ---------------------------------------------------------------------------

/**
 * Formats a date in Mexico City locale.
 * Default shows "22 jun 2026".
 */
export function formatDateMX(
  date: Date | string,
  opts: Intl.DateTimeFormatOptions = {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  },
): string {
  return new Date(date).toLocaleDateString('es-MX', { timeZone: TZ, ...opts });
}

/**
 * Formats a time in Mexico City timezone (24-hour HH:MM by default).
 */
export function formatTimeMX(
  date: Date | string,
  opts: Intl.DateTimeFormatOptions = {
    hour:   '2-digit',
    minute: '2-digit',
    hour12: false,
  },
): string {
  return new Date(date).toLocaleTimeString('es-MX', { timeZone: TZ, ...opts });
}

/**
 * Returns the current date in Mexico City as an ISO date string (YYYY-MM-DD).
 * Unlike `new Date().toISOString().split('T')[0]` which returns the UTC date,
 * this correctly reflects the local MX date.
 */
export function todayInMX(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: TZ }); // sv-SE gives YYYY-MM-DD
}

// ---------------------------------------------------------------------------
// Scheduling helper (for crons that need to target a specific MX local time)
// ---------------------------------------------------------------------------

/**
 * Returns the UTC ISO string for `hour:minute` *today* in Mexico City.
 * Handles DST automatically.
 *
 * @example
 *   scheduledForMX(7, 0)  // → "2026-06-23T13:00:00.000Z" when MX is UTC-6
 */
export function scheduledForMX(hour: number, minute = 0): string {
  const mxDate   = todayInMX(); // "2026-06-23"
  // Create a "naive" MX local datetime (no TZ suffix → treated as local by JS)
  const mxNaive  = new Date(
    `${mxDate}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`,
  );
  const offsetMs = getMXOffsetMs(mxNaive);
  return new Date(mxNaive.getTime() + offsetMs).toISOString();
}
