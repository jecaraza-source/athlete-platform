/**
 * Athletes have a fixed window to answer a scheduled assessment. The window
 * starts when the assessment is generated, or when it opens if it was
 * scheduled for later, so a future assessment never starts out overdue.
 * The deadline is informational: it is shown to the athlete, not enforced.
 */
export const PSYCH_COMPLETION_WINDOW_DAYS = 5;

const DAY_MS = 24 * 60 * 60 * 1000;

export type AssessmentDeadline = {
  opensAt: Date;
  dueAt: Date;
  isOpen: boolean;
  /** Whole days left until dueAt (0 on the last day); negative once overdue. */
  daysLeft: number;
  isOverdue: boolean;
};

export function assessmentDeadline(
  createdAt: string,
  scheduledFor: string | null,
  now: Date = new Date(),
): AssessmentDeadline {
  const created = new Date(createdAt);
  const scheduled = scheduledFor ? new Date(scheduledFor) : null;
  const opensAt = scheduled && scheduled > created ? scheduled : created;
  const dueAt = new Date(opensAt.getTime() + PSYCH_COMPLETION_WINDOW_DAYS * DAY_MS);
  const remainingMs = dueAt.getTime() - now.getTime();
  return {
    opensAt,
    dueAt,
    isOpen: opensAt <= now,
    daysLeft: remainingMs >= 0 ? Math.floor(remainingMs / DAY_MS) : -Math.ceil(-remainingMs / DAY_MS),
    isOverdue: remainingMs < 0,
  };
}
