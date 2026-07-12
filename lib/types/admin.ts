// Admin Console types

export type AppointmentStatus = 'confirmed' | 'show' | 'no_show' | 'no_show_remote' | 'rescheduled' | 'cancelled';
export type ServiceType = 'medico' | 'nutricion' | 'fisioterapia' | 'psicologia' | 'evaluacion' | 'entrenamiento';

export interface Appointment {
  id: string;
  date: string;
  time: string;
  status: AppointmentStatus;
  notes: string | null;
  service_type: ServiceType;
  original_date: string | null;
  original_appointment_id: string | null;
  confirmed_by: string | null;
  confirmed_at: string | null;
  no_show_reason: string | null;
  reschedule_reason: string | null;
  athlete: {
    id: string;
    full_name: string;
    email: string;
    avatar_url: string | null;
  };
  specialist: {
    id: string;
    full_name: string;
    specialty: string;
  };
}

export interface KpiData {
  value: number;
  previousValue: number;
  trend: 'up' | 'down' | 'neutral';
  trendPercent: number;
}

export interface KpiSet {
  totalAppointments:     KpiData;
  attendanceRate:        KpiData;
  activeAthletes:        KpiData;
  newRegistrations:      KpiData;
  /** Appointments with status='confirmed' and date >= today (global, no period filter). */
  scheduledAppointments: KpiData;
  /** Appointments with status='no_show' in the selected period. */
  noShowAppointments:    KpiData;
  /**
   * Absolute count of attended interactions in the period:
   * events.status='show' + training_sessions.is_done=true.
   * Use this for the attendance donut instead of deriving from rate×total.
   */
  attendedCount:         KpiData;
}

export interface ServiceStat {
  service_type: ServiceType;
  label: string;
  count: number;
  percentage: number;
  previousCount: number;
  trend: 'up' | 'down' | 'neutral';
}

export interface HeatmapCell {
  day: number;   // 0=Lun, 6=Dom
  hour: number;  // 7–22
  count: number;
}

export interface SpecialistLoad {
  id: string;
  full_name: string;
  specialty: string;
  appointmentCount: number;
  capacity: number;
  utilizationPercent: number;
}

export interface RealtimeAlert {
  id: string;
  type: 'unconfirmed' | 'consecutive_noshow' | 'new_athlete' | 'pending_reschedule';
  message: string;
  appointmentId?: string;
  athleteId?: string;
  createdAt: string;
}

export type PeriodKey = 'today' | 'week' | 'month' | '3months';

// ─── Report types ─────────────────────────────────────────────────────────────

export type ReportPeriodKey = 'today' | 'week' | 'month' | 'quarter';

export interface ReportServiceRow {
  /** Display label, e.g. "MÉDICO" */
  service: string;
  /** All events in period regardless of status */
  scheduled: number;
  /** Events with status='show' */
  attendedPresential: number;
  /** Events with status='show_remote'; null = NO APLICA for this service */
  attendedRemote: number | null;
  /** Follow-up session notes logged in period */
  followUpNotes: number;
  /** Events with status IN ('no_show', 'no_show_remote') */
  noShow: number;
}

export interface ReportCoachRow {
  coachId: string;
  coachName: string;
  discipline: string;
  /** Distinct athletes with training_sessions in period */
  totalAthletes: number;
  /** Plans of type='training' created by this coach in period */
  totalPlans: number;
  /** training_sessions logged by this coach in period */
  totalNotes: number;
}

export interface ReportData {
  activeAthletes: number;
  from: string;
  to: string;
  services: ReportServiceRow[];
  coaches: ReportCoachRow[];
}

export interface PeriodRange {
  from: string; // ISO date
  to: string;   // ISO date
  label: string;
}

export interface AppointmentFilters {
  serviceType: ServiceType | 'all';
  status: AppointmentStatus | 'all';
  dateFrom: string;
  dateTo: string;
  search: string;
}
