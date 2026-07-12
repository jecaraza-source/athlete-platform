/**
 * Athlete types and utilities
 */

export type AthleteStatus = 'active' | 'inactive';

/**
 * Translate athlete status to Spanish
 * @param status - 'active' or 'inactive'
 * @returns Spanish translation: 'Activo' or 'Inactivo'
 */
export function getAthleteStatusLabel(status: AthleteStatus | string | null): string {
  switch (status?.toLowerCase()) {
    case 'active':
      return 'Activo';
    case 'inactive':
      return 'Inactivo';
    default:
      return 'Desconocido';
  }
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
    default:
      return 'bg-gray-100 text-gray-600';
  }
}
