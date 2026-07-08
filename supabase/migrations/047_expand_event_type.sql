-- 047_expand_event_type.sql
-- Expands the events.event_type check constraint to include the new
-- healthcare activity types: physio, nutrition, psychology.
-- Previous allowed values: training, competition, meeting, medical, evaluation, other

ALTER TABLE events DROP CONSTRAINT IF EXISTS events_event_type_check;

ALTER TABLE events
  ADD CONSTRAINT events_event_type_check CHECK (
    event_type IN (
      'training',
      'competition',
      'meeting',
      'medical',
      'physio',
      'nutrition',
      'psychology',
      'evaluation',
      'other'
    )
  );
