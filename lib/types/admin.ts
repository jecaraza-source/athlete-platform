// Admin Console types

export type AppointmentStatus = 'confirmed' | 'show' | 'no_show' | 'rescheduled' | 'cancelled';
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
