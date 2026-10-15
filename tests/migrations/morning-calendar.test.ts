/**
 * 20260903000001_morning_calendar.sql was applied in production outside the
 * migration history, so tooling may run it again. It must not rewrite the
 * shift of existing events (243 morning events existed when it was recorded).
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const sql = readFileSync(
  path.resolve(__dirname, '../../supabase/migrations/20260903000001_morning_calendar.sql'),
  'utf8',
);
const statements = sql.replace(/--.*$/gm, '');

describe('morning calendar migration', () => {
  it('never updates existing events', () => {
    expect(statements).not.toMatch(/UPDATE\s+(public\.)?events/i);
  });

  it('only uses idempotent DDL and inserts', () => {
    expect(statements).toMatch(/ADD COLUMN IF NOT EXISTS shift/);
    expect(statements).toMatch(/CREATE TABLE IF NOT EXISTS profile_permissions/);
    expect(statements.match(/INSERT INTO/g)).toHaveLength(2);
    expect(statements.match(/ON CONFLICT/g)).toHaveLength(2);
  });
});
