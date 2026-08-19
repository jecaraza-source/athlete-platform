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
  /** Events attended remotely: status='show_remote' or status='no_show_remote'; null = NO APLICA */
  attendedRemote: number | null;
  /** Events with status='no_show' */
  noShow: number;
}


export interface ReportTrainingDisciplineRow {
  disciplineCode: string;
  disciplineName: string;
  disciplineBlock: string;
  /** Active athletes in this discipline with at least one training plan assignment. */
  athletesWithPlans: number;
  /** Distinct training plans assigned to athletes in this discipline, all time. */
  trainingPlans: number;
  /** Total athlete-plan assignments for training plans, all time. */
  planAssignments: number;
}

export interface ReportStaffMemberRow {
  staffId: string;
  staffName: string;
  /** Rol legible: Médico, Nutricionista, Fisioterapeuta, Psicólogo/a */
  roleLabel: string;
  /** Total de eventos en el período (todos los estatus) */
  scheduled: number;
  /** Eventos status='scheduled' con start_at futuro al momento del reporte */
  upcoming: number;
  /** Eventos con status='show' */
  attendedPresential: number;
  /** Eventos atendidos remotamente: status='show_remote' o status='no_show_remote' */
  attendedRemote: number;
  /** Eventos con status='rescheduled' */
  rescheduled: number;
  /** Eventos con status='no_show' */
  noShow: number;
  /** Tasa de asistencia: (show+show_remote)/(show+show_remote+no_show) × 100
   *  null cuando no hay eventos con resultado conocido aún */
  attendanceRate: number | null;
}

export interface ReportDisciplineRow {
  disciplineCode: string;
  disciplineName: string;
  disciplineBlock: string;
  /** Atletas activos registrados en esta disciplina */
  totalAthletes: number;
  /** Atletas que tuvieron al menos 1 cita presencial o remota en el período */
  athletesAttended: number;
  /** Atletas que tuvieron al menos 1 no_show en el período */
  athletesNoShow: number;
  /** Atletas con al menos 1 cita futura programada (status='scheduled', start_at > now) */
  athletesWithUpcomingApts: number;
  /** Atletas con al menos 1 plan asignado (acumulado) */
  athletesWithPlans: number;
}

export interface ReportData {
  activeAthletes: number;
  from: string;
  to: string;
  services: ReportServiceRow[];
  trainingDisciplines: ReportTrainingDisciplineRow[];
  staffMembers: ReportStaffMemberRow[];
  disciplines: ReportDisciplineRow[];
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
