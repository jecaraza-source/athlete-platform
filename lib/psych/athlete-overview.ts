import { supabaseAdmin } from '@/lib/supabase-admin';
import { assessmentDeadline, PSYCH_COMPLETION_WINDOW_DAYS } from '@/lib/psych/deadline';
import { getAthletePublishedResults, type AthletePublishedResult } from '@/lib/psych/athlete-results';

/**
 * Everything an athlete may know about their own psychological tests, shared
 * by the web pages and the mobile API: pending tests with their completion
 * window, tests already answered (name and date only) and published results.
 */

export type AthletePendingAssessment = {
  id: string;
  instrumentName: string;
  createdAt: string;
  opensAt: string;
  dueAt: string;
  isOpen: boolean;
  daysLeft: number;
  isOverdue: boolean;
};

export type AthleteAnsweredAssessment = {
  id: string;
  instrumentName: string;
  completedAt: string | null;
};

export type AthletePsychOverview = {
  completionWindowDays: number;
  pending: AthletePendingAssessment[];
  answered: AthleteAnsweredAssessment[];
  results: AthletePublishedResult[];
};

type InstrumentEmbed = { name: string } | { name: string }[] | null;

function instrumentName(embed: InstrumentEmbed): string | null {
  return (Array.isArray(embed) ? embed[0]?.name : embed?.name) ?? null;
}

export async function getAthletePendingAssessments(
  athleteProfileId: string,
  now: Date = new Date(),
): Promise<AthletePendingAssessment[]> {
  const { data, error } = await supabaseAdmin
    .from('psych_assessments')
    .select('id, created_at, scheduled_for, psych_instruments!inner(name, is_active, is_test_only, license_status)')
    .eq('athlete_id', athleteProfileId)
    .eq('status', 'pending')
    .eq('psych_instruments.is_active', true)
    .eq('psych_instruments.is_test_only', false)
    .in('psych_instruments.license_status', ['licensed', 'not_required'])
    .order('created_at', { ascending: true });
  if (error) throw new Error(`psych_assessments query failed: ${error.message}`);

  return ((data ?? []) as Array<{ id: string; created_at: string; scheduled_for: string | null; psych_instruments: InstrumentEmbed }>)
    .flatMap((row) => {
      const name = instrumentName(row.psych_instruments);
      if (!name) return [];
      const deadline = assessmentDeadline(row.created_at, row.scheduled_for, now);
      return [{
        id: row.id,
        instrumentName: name,
        createdAt: row.created_at,
        opensAt: deadline.opensAt.toISOString(),
        dueAt: deadline.dueAt.toISOString(),
        isOpen: deadline.isOpen,
        daysLeft: deadline.daysLeft,
        isOverdue: deadline.isOverdue,
      }];
    });
}

export async function getAthleteAnsweredAssessments(athleteProfileId: string): Promise<AthleteAnsweredAssessment[]> {
  const { data, error } = await supabaseAdmin
    .from('psych_assessments')
    .select('id, completed_at, psych_instruments!inner(name, is_test_only)')
    .eq('athlete_id', athleteProfileId)
    .in('status', ['completed', 'under_review', 'approved'])
    .eq('psych_instruments.is_test_only', false)
    .order('completed_at', { ascending: false });
  if (error) throw new Error(`psych_assessments query failed: ${error.message}`);

  return ((data ?? []) as Array<{ id: string; completed_at: string | null; psych_instruments: InstrumentEmbed }>)
    .flatMap((row) => {
      const name = instrumentName(row.psych_instruments);
      return name ? [{ id: row.id, instrumentName: name, completedAt: row.completed_at }] : [];
    });
}

export async function getAthletePsychOverview(athleteProfileId: string): Promise<AthletePsychOverview> {
  const [pending, answered, results] = await Promise.all([
    getAthletePendingAssessments(athleteProfileId),
    getAthleteAnsweredAssessments(athleteProfileId),
    getAthletePublishedResults(athleteProfileId),
  ]);
  return { completionWindowDays: PSYCH_COMPLETION_WINDOW_DAYS, pending, answered, results };
}
