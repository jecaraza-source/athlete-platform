// Types originally from @athlete-platform/shared (packages/shared/src/types.ts)
// Inlined here so the web app has no external file:// dependency in production.

export type UserRole =
  | 'super_admin'
  | 'program_director'
  | 'coach'
  | 'nutritionist'
  | 'physio'
  | 'psychologist'
  | 'event_coordinator'
  | 'athlete'
  | 'guardian';

export type AthleteStatus =
  | 'active'
  | 'inactive'
  | 'injured'
  | 'suspended';

export type DiagnosticStatus =
  | 'pendiente'
  | 'en_proceso'
  | 'completo'
  | 'requiere_atencion';

export type DisabilityStatus =
  | 'con_discapacidad'
  | 'sin_discapacidad';

export type AthleteWithDiagnostic = {
  id: string;
  first_name: string;
  last_name: string;
  status: AthleteStatus;
  discipline: string | null;
  disability_status: DisabilityStatus | null;
  diagnostic_status: DiagnosticStatus | null;
  diagnostic_pct: number | null;
};
