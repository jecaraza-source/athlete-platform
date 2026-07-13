'use server';
import ExcelJS from 'exceljs';
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

/**
 * Generates an Excel workbook from appointment data and returns the raw bytes.
 * Runs as a Server Action — ExcelJS (Node.js) never ships to the client bundle.
 * The caller is responsible for triggering the browser download from the buffer.
 */
export async function exportAppointmentsToExcel(
  data: Appointment[],
  periodLabel: string,
): Promise<Uint8Array<ArrayBuffer>> {
  const workbook = new ExcelJS.Workbook();

  // ── Hoja 1: Detalle completo ──────────────────────────────────────────────
  const ws1 = workbook.addWorksheet('Citas');
  ws1.columns = [
    { header: '#',                     key: '#',                     width: 4  },
    { header: 'Atleta',                key: 'Atleta',                width: 28 },
    { header: 'Email Atleta',          key: 'Email Atleta',          width: 32 },
    { header: 'Especialista',          key: 'Especialista',          width: 28 },
    { header: 'Especialidad',          key: 'Especialidad',          width: 22 },
    { header: 'Fecha',                 key: 'Fecha',                 width: 12 },
    { header: 'Hora',                  key: 'Hora',                  width: 8  },
    { header: 'Estado',                key: 'Estado',                width: 14 },
    { header: 'Notas',                 key: 'Notas',                 width: 40 },
    { header: 'Motivo No Show',        key: 'Motivo No Show',        width: 20 },
    { header: 'Motivo Reagendamiento', key: 'Motivo Reagendamiento', width: 24 },
    { header: 'Fecha Original',        key: 'Fecha Original',        width: 14 },
    { header: 'Confirmado en',         key: 'Confirmado en',         width: 18 },
  ];
  ws1.addRows(buildDetailSheet(data));

  // ── Hoja 2: Resumen por especialidad ─────────────────────────────────────
  const ws2 = workbook.addWorksheet('Resumen');
  ws2.columns = [
    { header: 'Especialidad',    key: 'Especialidad',    width: 26 },
    { header: 'Total Citas',     key: 'Total Citas',     width: 12 },
    { header: 'Atendió (Show)',  key: 'Atendió (Show)',  width: 16 },
    { header: 'No Atendió',      key: 'No Atendió',      width: 12 },
    { header: 'Reagendadas',     key: 'Reagendadas',     width: 12 },
    { header: 'Pendientes',      key: 'Pendientes',      width: 12 },
    { header: '% Asistencia',    key: '% Asistencia',    width: 14 },
  ];
  ws2.addRows(buildSummarySheet(data));

  const raw = await workbook.xlsx.writeBuffer();
  // new Uint8Array(source) copies data into a fresh ArrayBuffer (never
  // SharedArrayBuffer), giving us Uint8Array<ArrayBuffer> which is a
  // valid BlobPart on the client.
  return new Uint8Array(raw as ArrayBuffer) as Uint8Array<ArrayBuffer>;
}
