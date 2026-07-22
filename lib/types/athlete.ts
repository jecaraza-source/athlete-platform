/**
 * Athlete types and utilities
 */

// Re-export canonical type from shared package to avoid drift.
// The DB allows: 'active' | 'inactive' | 'injured' | 'suspended'
export type AthleteStatus = 'active' | 'inactive' | 'injured' | 'suspended';

const ATHLETE_STATUS_LABELS: Record<string, string> = {
  active:    'Activo',
  inactive:  'Inactivo',
  injured:   'Lesionado',
  suspended: 'Suspendido',
};

/**
 * Translate athlete status to Spanish.
 * Returns '—' when status is null/undefined (athlete has no record in the athletes table).
 */
export function getAthleteStatusLabel(status: AthleteStatus | string | null): string {
  if (!status) return '—';
  return ATHLETE_STATUS_LABELS[status.toLowerCase()] ?? status;
}

/**
 * Get CSS class for athlete status badge
 * @param status - 'active' or 'inactive'
 * @returns Tailwind CSS class string
 */
export function getAthleteStatusBadgeClass(status: AthleteStatus | string | null): string {
  switch (status?.toLowerCase()) {
    case 'active':
      return 'bg-green-100 text-green-700';
    case 'inactive':
      return 'bg-gray-100 text-gray-600';
    case 'injured':
      return 'bg-amber-100 text-amber-700';
    case 'suspended':
      return 'bg-red-100 text-red-700';
    default:
      return 'bg-gray-100 text-gray-600';
  }
}
