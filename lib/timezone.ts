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

// ---------------------------------------------------------------------------
// Parsing helper (for <input type="datetime-local"> values entered in MX time)
// ---------------------------------------------------------------------------

const MX_PARTS_FORMAT = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

/** Milliseconds Mexico City wall-clock is ahead of UTC at `instant` (negative for UTC-6). */
function mxWallOffsetMs(instant: number): number {
  const parts = Object.fromEntries(
    MX_PARTS_FORMAT.formatToParts(new Date(instant)).map((part) => [part.type, part.value]),
  );
  const wallAsUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return wallAsUtc - Math.floor(instant / 1000) * 1000;
}

/**
 * Interprets a naive "YYYY-MM-DDTHH:mm[:ss]" value (as sent by a
 * datetime-local input) as Mexico City wall-clock time and returns the
 * matching instant. Returns null for malformed or non-existent values.
 * Independent of the process timezone, unlike `new Date(value)`.
 *
 * @example
 *   parseMXLocalDateTime('2026-10-15T09:00') // → 2026-10-15T15:00:00.000Z
 */
export function parseMXLocalDateTime(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value.trim());
  if (!match) return null;
  const [year, month, day, hour, minute, second = '0'] = match.slice(1);
  const wallAsUtc = Date.UTC(+year, +month - 1, +day, +hour, +minute, +second);
  const wall = new Date(wallAsUtc);
  // Date.UTC silently rolls over impossible values such as Feb 30 or 25:00.
  if (wall.getUTCMonth() !== +month - 1 || wall.getUTCDate() !== +day || wall.getUTCHours() !== +hour || wall.getUTCMinutes() !== +minute) return null;
  // Two passes settle the offset around historical DST transitions.
  let instant = wallAsUtc - mxWallOffsetMs(wallAsUtc);
  instant = wallAsUtc - mxWallOffsetMs(instant);
  const roundTrip = new Date(instant + mxWallOffsetMs(instant));
  if (roundTrip.getTime() !== wallAsUtc) return null;
  return new Date(instant);
}
