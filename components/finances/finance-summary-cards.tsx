'use client';

import { useTranslations } from 'next-intl';
import type { FinanceSummary } from '@/lib/types/finance';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
  }).format(value);
}

function SummaryCard({
  title,
  value,
  subtitle,
  colorClass,
}: {
  title: string;
  value: string;
  subtitle?: string;
  colorClass: string;
}) {
  return (
    <div className={`rounded-lg border p-5 ${colorClass}`}>
      <p className="text-sm font-medium text-current opacity-80">{title}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
      {subtitle && (
        <p className="mt-1 text-xs opacity-70">{subtitle}</p>
      )}
    </div>
  );
}

export function FinanceSummaryCards({ summary }: { summary: FinanceSummary }) {
  const t = useTranslations('finances.summary');
  const exercisedPct =
    summary.total_budget > 0
      ? Math.min(100, Math.round((summary.total_exercised / summary.total_budget) * 100))
      : 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          title={t('totalBudget')}
          value={formatCurrency(summary.total_budget)}
          colorClass="bg-indigo-50 text-indigo-900 border-indigo-200"
        />
        <SummaryCard
          title={t('exercised')}
          value={formatCurrency(summary.total_exercised)}
          subtitle={`${exercisedPct}% del presupuesto`}
          colorClass="bg-emerald-50 text-emerald-900 border-emerald-200"
        />
        <SummaryCard
          title={t('available')}
          value={formatCurrency(summary.total_available)}
          colorClass={
            summary.total_available < 0
              ? 'bg-red-50 text-red-900 border-red-200'
              : 'bg-sky-50 text-sky-900 border-sky-200'
          }
        />
        <SummaryCard
          title={t('pendingApproval')}
          value={String(summary.pending_approval_count)}
          subtitle={
            summary.pending_approval_count > 0
              ? formatCurrency(summary.pending_approval_amount)
              : t('noPending')
          }
          colorClass="bg-amber-50 text-amber-900 border-amber-200"
        />
      </div>

      <div>
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>{t('exercisedLabel')}</span>
          <span>{exercisedPct}%</span>
        </div>
        <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              exercisedPct > 90 ? 'bg-red-500' : exercisedPct > 70 ? 'bg-amber-500' : 'bg-emerald-500'
            }`}
            style={{ width: `${exercisedPct}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {summary.by_category.length > 0 && (
          <div className="sm:col-span-2 rounded-lg border border-gray-200 bg-white p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">{t('byCategory')}</h3>
            <ul className="space-y-2">
              {summary.by_category.slice(0, 6).map((c) => {
                const pct =
                  summary.total_exercised > 0
                    ? Math.round((c.total / summary.total_exercised) * 100)
                    : 0;
                return (
                  <li key={c.category_name} className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: c.color ?? '#9ca3af' }}
                    />
                    <span className="text-sm text-gray-700 flex-1 truncate">{c.category_name}</span>
                    <span className="text-xs text-gray-500 shrink-0">{pct}%</span>
                    <span className="text-sm font-medium text-gray-900 shrink-0 min-w-[90px] text-right">
                      {formatCurrency(c.total)}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <div className="rounded-lg border border-teal-200 bg-teal-50 p-5">
          <h3 className="text-sm font-semibold text-teal-800 mb-2">{t('athleteExpenses')}</h3>
          <p className="text-2xl font-bold text-teal-900">
            {formatCurrency(summary.athlete_expenses_total)}
          </p>
          <p className="text-xs text-teal-700 mt-1">
            {t('athleteCount', { count: summary.athlete_expenses_count })}
          </p>
        </div>
      </div>
    </div>
  );
}
