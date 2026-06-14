import {
  format,
  startOfDay, endOfDay,
  startOfWeek, endOfWeek,
  startOfMonth, endOfMonth,
  subMonths, subWeeks, subDays,
} from 'date-fns';
import type { PeriodKey, PeriodRange } from '@/lib/types/admin';

export function getPeriodRange(period: PeriodKey): PeriodRange {
  const now = new Date();
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
  const now = new Date();
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

export function calcTrend(current: number, previous: number) {
  if (previous === 0) return { trend: 'neutral' as const, trendPercent: 0 };
  const diff = ((current - previous) / previous) * 100;
  return {
    trend: diff > 0 ? 'up' as const : diff < 0 ? 'down' as const : 'neutral' as const,
    trendPercent: Math.abs(Math.round(diff)),
  };
}
