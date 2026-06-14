import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Appointment, ServiceType } from '@/lib/types/admin';

const STATUS_LABELS: Record<string, string> = {
  confirmed:   'Confirmada',
  show:        'Atendió',
  no_show:     'No Atendió',
  rescheduled: 'Reagendada',
  cancelled:   'Cancelada',
};

const SERVICE_LABELS: Record<ServiceType, string> = {
  medico:        'Consulta Médica',
  nutricion:     'Nutrición',
  fisioterapia:  'Fisioterapia',
  psicologia:    'Psicología',
  evaluacion:    'Evaluación de Rendimiento',
  entrenamiento: 'Plan de Entrenamiento',
};

function buildDetailSheet(data: Appointment[]) {
  return data.map((apt, i) => ({
    '#': i + 1,
    'Atleta': apt.athlete.full_name,
    'Email Atleta': apt.athlete.email,
    'Especialista': apt.specialist.full_name,
    'Especialidad': SERVICE_LABELS[apt.service_type] ?? apt.service_type,
    'Fecha': format(new Date(apt.date), 'dd/MM/yyyy', { locale: es }),
    'Hora': apt.time,
    'Estado': STATUS_LABELS[apt.status] ?? apt.status,
    'Notas': apt.notes ?? '',
    'Motivo No Show': apt.no_show_reason ?? '',
    'Motivo Reagendamiento': apt.reschedule_reason ?? '',
    'Fecha Original': apt.original_date ? format(new Date(apt.original_date), 'dd/MM/yyyy', { locale: es }) : '',
    'Confirmado en': apt.confirmed_at ? format(new Date(apt.confirmed_at), "dd/MM/yyyy HH:mm", { locale: es }) : '',
  }));
}

function buildSummarySheet(data: Appointment[]) {
  const services = [...new Set(data.map(a => a.service_type))];
  return services.map(st => {
    const group       = data.filter(a => a.service_type === st);
    const total       = group.length;
    const shows       = group.filter(a => a.status === 'show').length;
    const noShows     = group.filter(a => a.status === 'no_show').length;
    const rescheduled = group.filter(a => a.status === 'rescheduled').length;
    const confirmed   = group.filter(a => a.status === 'confirmed').length;
    return {
      'Especialidad':    SERVICE_LABELS[st] ?? st,
      'Total Citas':     total,
      'Atendió (Show)':  shows,
      'No Atendió':      noShows,
      'Reagendadas':     rescheduled,
      'Pendientes':      confirmed,
      '% Asistencia':    total > 0 ? `${Math.round((shows / total) * 100)}%` : '—',
    };
  });
}

export function exportAppointmentsToExcel(data: Appointment[], periodLabel: string) {
  const wb = XLSX.utils.book_new();

  // Hoja 1: Detalle completo
  const ws1 = XLSX.utils.json_to_sheet(buildDetailSheet(data));
  ws1['!cols'] = [
    { wch: 4 }, { wch: 28 }, { wch: 32 }, { wch: 28 }, { wch: 22 },
    { wch: 12 }, { wch: 8 }, { wch: 14 }, { wch: 40 }, { wch: 20 },
    { wch: 24 }, { wch: 14 }, { wch: 18 },
  ];
  XLSX.utils.book_append_sheet(wb, ws1, 'Citas');

  // Hoja 2: Resumen por especialidad
  const ws2 = XLSX.utils.json_to_sheet(buildSummarySheet(data));
  ws2['!cols'] = [
    { wch: 26 }, { wch: 12 }, { wch: 16 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 14 },
  ];
  XLSX.utils.book_append_sheet(wb, ws2, 'Resumen');

  const stamp      = format(new Date(), 'yyyyMMdd-HHmm');
  const safePeriod = periodLabel.replace(/\s/g, '-').toLowerCase();
  XLSX.writeFile(wb, `citas-ao-deporte-${safePeriod}-${stamp}.xlsx`);
}
