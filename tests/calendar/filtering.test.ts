/**
 * Unit tests for calendar event filtering logic.
 *
 * Covers:
 *  - Sport filter (by sport_id) in the calendar grid and event list
 *  - Athlete filter (by participant membership) in the event list
 *  - Combined AND behaviour when both filters are active
 *  - Edge cases: no events, filters that match nothing, null sport_id
 */

import { describe, it, expect } from 'vitest';

// ---------------------------------------------------------------------------
// Data fixtures
// ---------------------------------------------------------------------------

const SPORTS = {
  soccer:     { id: 'sport-soccer',     name: 'Soccer',     category_type: 'team'       },
  basketball: { id: 'sport-basketball', name: 'Basketball', category_type: 'team'       },
  swimming:   { id: 'sport-swimming',   name: 'Swimming',   category_type: 'individual' },
};

const ATHLETES = {
  paola: { id: 'ath-paola', first_name: 'Paola', last_name: 'Longoria' },
  luis:  { id: 'ath-luis',  first_name: 'Luis',  last_name: 'Martinez' },
  ana:   { id: 'ath-ana',   first_name: 'Ana',   last_name: 'Lopez'    },
};

type Event = {
  id: string;
  title: string;
  event_type: string;
  sport_id: string | null;
  sport_name: string | null;
  start_at: string;
  end_at: string;
  status: string;
  description: string | null;
};

const EVENTS: Event[] = [
  {
    id: 'ev-1', title: 'Soccer Practice', event_type: 'training',
    sport_id: SPORTS.soccer.id, sport_name: 'Soccer',
    start_at: '2026-04-10T09:00:00Z', end_at: '2026-04-10T11:00:00Z',
    status: 'scheduled', description: null,
  },
  {
    id: 'ev-2', title: 'Basketball Match', event_type: 'competition',
    sport_id: SPORTS.basketball.id, sport_name: 'Basketball',
    start_at: '2026-04-11T14:00:00Z', end_at: '2026-04-11T16:00:00Z',
    status: 'scheduled', description: null,
  },
  {
    id: 'ev-3', title: 'Swimming Gala', event_type: 'competition',
    sport_id: SPORTS.swimming.id, sport_name: 'Swimming',
    start_at: '2026-04-12T08:00:00Z', end_at: '2026-04-12T12:00:00Z',
    status: 'scheduled', description: null,
  },
  {
    id: 'ev-4', title: 'Team Meeting', event_type: 'meeting',
    sport_id: null, sport_name: null,  // general / no sport
    start_at: '2026-04-13T10:00:00Z', end_at: '2026-04-13T11:00:00Z',
    status: 'scheduled', description: 'Monthly review',
  },
];

// Participant map: event_id → athlete ids that are participants
const PARTICIPANTS: Record<string, string[]> = {
  'ev-1': [ATHLETES.paola.id, ATHLETES.luis.id],  // soccer — paola + luis
  'ev-2': [ATHLETES.paola.id],                     // basketball — paola only
  'ev-3': [ATHLETES.ana.id],                       // swimming — ana only
  'ev-4': [],                                       // meeting — no athletes
};

// ---------------------------------------------------------------------------
// Pure filtering functions mirroring the client component logic
// ---------------------------------------------------------------------------

function filterBySport(events: Event[], sportId: string): Event[] {
  if (!sportId) return events;
  return events.filter((e) => e.sport_id === sportId);
}

function filterByAthleteAndSport(
  events: Event[],
  participantsByEvent: Record<string, string[]>,
  athleteId: string,
  sportId: string,
): Event[] {
  return events.filter((e) => {
    const matchesAthlete = !athleteId ||
      (participantsByEvent[e.id] ?? []).includes(athleteId);
    const matchesSport = !sportId || e.sport_id === sportId;
    return matchesAthlete && matchesSport;
  });
}

// ---------------------------------------------------------------------------
// Sport filter tests
// ---------------------------------------------------------------------------

describe('filterBySport (calendar grid)', () => {
  it('returns all events when no sport is selected (empty string)', () => {
    const result = filterBySport(EVENTS, '');
    expect(result).toHaveLength(4);
  });

  it('returns only soccer events when soccer is selected', () => {
    const result = filterBySport(EVENTS, SPORTS.soccer.id);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('ev-1');
  });

  it('returns only basketball events when basketball is selected', () => {
    const result = filterBySport(EVENTS, SPORTS.basketball.id);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('ev-2');
  });

  it('returns only swimming events when swimming is selected', () => {
    const result = filterBySport(EVENTS, SPORTS.swimming.id);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('ev-3');
  });

  it('returns empty array when the sport has no events', () => {
    const result = filterBySport(EVENTS, 'sport-nonexistent');
    expect(result).toHaveLength(0);
  });

  it('excludes events with null sport_id when any sport is selected', () => {
    const result = filterBySport(EVENTS, SPORTS.soccer.id);
    const hasNullSport = result.some((e) => e.sport_id === null);
    expect(hasNullSport).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Athlete + Sport combined filter tests (EventsListClient logic)
// ---------------------------------------------------------------------------

describe('filterByAthleteAndSport (event list)', () => {
  it('returns all events when both filters are empty', () => {
    const result = filterByAthleteAndSport(EVENTS, PARTICIPANTS, '', '');
    expect(result).toHaveLength(4);
  });

  it('filters by athlete only — returns events Paola participates in', () => {
    const result = filterByAthleteAndSport(EVENTS, PARTICIPANTS, ATHLETES.paola.id, '');
    // Paola is in ev-1 (soccer) and ev-2 (basketball)
    expect(result.map(e => e.id).sort()).toEqual(['ev-1', 'ev-2']);
  });

  it('filters by athlete only — returns events Ana participates in', () => {
    const result = filterByAthleteAndSport(EVENTS, PARTICIPANTS, ATHLETES.ana.id, '');
    // Ana is only in ev-3 (swimming)
    expect(result.map(e => e.id)).toEqual(['ev-3']);
  });

  it('filters by sport only — returns all Soccer events', () => {
    const result = filterByAthleteAndSport(EVENTS, PARTICIPANTS, '', SPORTS.soccer.id);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('ev-1');
  });

  it('combined AND: Paola + Soccer → ev-1 only', () => {
    const result = filterByAthleteAndSport(
      EVENTS, PARTICIPANTS, ATHLETES.paola.id, SPORTS.soccer.id,
    );
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('ev-1');
  });

  it('combined AND: Paola + Swimming → empty (Paola is not in swimming)', () => {
    const result = filterByAthleteAndSport(
      EVENTS, PARTICIPANTS, ATHLETES.paola.id, SPORTS.swimming.id,
    );
    expect(result).toHaveLength(0);
  });

  it('combined AND: Ana + Soccer → empty (Ana is not in soccer)', () => {
    const result = filterByAthleteAndSport(
      EVENTS, PARTICIPANTS, ATHLETES.ana.id, SPORTS.soccer.id,
    );
    expect(result).toHaveLength(0);
  });

  it('combined AND: Ana + Swimming → ev-3 only', () => {
    const result = filterByAthleteAndSport(
      EVENTS, PARTICIPANTS, ATHLETES.ana.id, SPORTS.swimming.id,
    );
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('ev-3');
  });

  it('athlete filter: events with no participants are excluded', () => {
    // ev-4 (meeting) has no participants — should be filtered out for any athlete
    const result = filterByAthleteAndSport(EVENTS, PARTICIPANTS, ATHLETES.luis.id, '');
    const ids = result.map(e => e.id);
    expect(ids).not.toContain('ev-4');
  });

  it('sport filter: general events (null sport_id) are excluded when any sport is selected', () => {
    const result = filterByAthleteAndSport(EVENTS, PARTICIPANTS, '', SPORTS.soccer.id);
    const ids = result.map(e => e.id);
    expect(ids).not.toContain('ev-4'); // meeting has null sport_id
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('edge cases', () => {
  it('handles empty events array gracefully', () => {
    expect(filterBySport([], SPORTS.soccer.id)).toEqual([]);
    expect(filterByAthleteAndSport([], {}, ATHLETES.paola.id, SPORTS.soccer.id)).toEqual([]);
  });

  it('handles unknown athlete ID (returns only events with no participants required)', () => {
    const result = filterByAthleteAndSport(EVENTS, PARTICIPANTS, 'ath-unknown', '');
    expect(result).toHaveLength(0); // no event has 'ath-unknown' as participant
  });

  it('handles events with null sport_id — never matches a specific sport filter', () => {
    const nullSportEvent: Event = {
      id: 'ev-null-sport', title: 'Generic', event_type: 'other',
      sport_id: null, sport_name: null,
      start_at: '2026-04-14T10:00:00Z', end_at: '2026-04-14T11:00:00Z',
      status: 'scheduled', description: null,
    };
    expect(filterBySport([nullSportEvent], SPORTS.soccer.id)).toHaveLength(0);
    expect(filterBySport([nullSportEvent], '')).toHaveLength(1);
  });
});
