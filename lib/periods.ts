import {
  format,
  startOfDay, endOfDay,
  startOfWeek, endOfWeek,
  startOfMonth, endOfMonth,
  subMonths, subWeeks, subDays,
} from 'date-fns';
import type { PeriodKey, PeriodRange, ReportPeriodKey } from '@/lib/types/admin';
import { nowInMX } from '@/lib/timezone';

export function getPeriodRange(period: PeriodKey): PeriodRange {
  // Use Mexico City "now" so day/week/month boundaries match local time,
  // not the UTC clock of the Vercel runtime.
  const now = nowInMX();
  const fmt = (d: Date) => format(d, 'yyyy-MM-dd');

  const ranges: Record<PeriodKey, PeriodRange> = {
    today: {
      from: fmt(startOfDay(now)),
      to: fmt(endOfDay(now)),
      label: 'Hoy',
    },
    week: {
      from: fmt(startOfWeek(now, { weekStartsOn: 1 })),
      to: fmt(endOfWeek(now, { weekStartsOn: 1 })),
      label: 'Esta semana',
    },
    month: {
      from: fmt(startOfMonth(now)),
      to: fmt(endOfMonth(now)),
      label: 'Este mes',
    },
    '3months': {
      from: fmt(startOfMonth(subMonths(now, 2))),
      to: fmt(endOfMonth(now)),
      label: 'Últimos 3 meses',
    },
  };
  return ranges[period];
}

export function getPreviousPeriodRange(period: PeriodKey): PeriodRange {
  const now = nowInMX();
  const fmt = (d: Date) => format(d, 'yyyy-MM-dd');

  const prev: Record<PeriodKey, PeriodRange> = {
    today: {
      from: fmt(startOfDay(subDays(now, 1))),
      to: fmt(endOfDay(subDays(now, 1))),
      label: 'Ayer',
    },
    week: {
      from: fmt(startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 })),
      to: fmt(endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 })),
      label: 'Semana anterior',
    },
    month: {
      from: fmt(startOfMonth(subMonths(now, 1))),
      to: fmt(endOfMonth(subMonths(now, 1))),
      label: 'Mes anterior',
    },
    '3months': {
      from: fmt(startOfMonth(subMonths(now, 5))),
      to: fmt(endOfMonth(subMonths(now, 3))),
      label: '3 meses anteriores',
    },
  };
  return prev[period];
}

// ─── Report period range ────────────────────────────────────────────────────────────

const MES_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const Q_NAMES = [
  'Q1 (Ene–Mar)', 'Q2 (Abr–Jun)', 'Q3 (Jul–Sep)', 'Q4 (Oct–Dic)',
];

export type ReportPeriodMeta = PeriodRange & {
  /** Short display title, e.g. "REPORTE MENSUAL" */
  reportTitle: string;
};

export function getReportPeriodRange(period: ReportPeriodKey): ReportPeriodMeta {
  const now     = nowInMX();
  const fmt     = (d: Date) => format(d, 'yyyy-MM-dd');
  const fmtDay  = (d: Date) => format(d, 'dd/MM/yyyy');

  const month       = now.getMonth();
  const year        = now.getFullYear();
  const qIdx        = Math.floor(month / 3);           // 0–3
  const qStartMonth = qIdx * 3;                         // 0, 3, 6, 9
  const qStart      = startOfMonth(new Date(year, qStartMonth, 1));
  const qEnd        = endOfMonth(new Date(year, qStartMonth + 2, 1));

  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd   = endOfWeek(now,   { weekStartsOn: 1 });

  const labels: Record<ReportPeriodKey, string> = {
    today:   fmtDay(now),
    week:    `${fmtDay(weekStart)} – ${fmtDay(weekEnd)}`,
    month:   `${MES_ES[month]} ${year}`,
    quarter: `${Q_NAMES[qIdx]} ${year}`,
  };

  const titles: Record<ReportPeriodKey, string> = {
    today:   'REPORTE DIARIO',
    week:    'REPORTE SEMANAL',
    month:   'REPORTE MENSUAL',
    quarter: 'REPORTE TRIMESTRAL',
  };

  const ranges: Record<ReportPeriodKey, { from: string; to: string }> = {
    today:   { from: fmt(startOfDay(now)), to: fmt(endOfDay(now)) },
    week:    { from: fmt(weekStart),       to: fmt(weekEnd) },
    month:   { from: fmt(startOfMonth(now)), to: fmt(endOfMonth(now)) },
    quarter: { from: fmt(qStart),           to: fmt(qEnd) },
  };

  return {
    ...ranges[period],
    label:       labels[period],
    reportTitle: titles[period],
  };
}

export function calcTrend(current: number, previous: number) {
  if (previous === 0) return { trend: 'neutral' as const, trendPercent: 0 };
  const diff = ((current - previous) / previous) * 100;
  return {
    trend: diff > 0 ? 'up' as const : diff < 0 ? 'down' as const : 'neutral' as const,
    trendPercent: Math.abs(Math.round(diff)),
  };
}
