'use client';

import { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend,
} from 'recharts';
import { ExpenseStatusBadge } from '@/components/finances/expense-status-badge';
import type { FinanceReportData } from '@/lib/finance/actions';
import type { ExpenseStatus } from '@/lib/types/finance';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (v: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(v);

const fmtShort = (v: number) => {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v}`;
};

const monthLabel = (m: string) => {
  const [y, mo] = m.split('-');
  const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  return `${months[parseInt(mo) - 1]} ${y.slice(2)}`;
};

// NOTE: METHOD_LABEL and STATUS_LABEL are computed inside the component using useTranslations

const STATUS_COLORS: Record<string, string> = {
  draft: '#94a3b8', submitted: '#f59e0b', approved: '#10b981',
  rejected: '#ef4444', paid: '#3b82f6', cancelled: '#6b7280',
};

const PIE_COLORS = [
  '#6366f1','#10b981','#f59e0b','#3b82f6','#ec4899',
  '#8b5cf6','#14b8a6','#ef4444','#f97316','#6b7280',
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function CurrencyTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ color: string; name: string; value: number }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-xs">
      <p className="font-semibold text-gray-800 mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }} className="font-medium">
          {p.name}: {fmt(p.value)}
        </p>
      ))}
    </div>
  );
}

function ChartCard({ title, subtitle, children, className = '' }: {
  title: string; subtitle?: string; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={`rounded-lg border border-gray-200 bg-white p-5 ${className}`}>
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
        {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function KPICard({ label, value, sub, color = 'indigo' }: {
  label: string; value: string; sub?: string; color?: string;
}) {
  const COLORS: Record<string, string> = {
    indigo:  'bg-indigo-50 text-indigo-900 border-indigo-200',
    emerald: 'bg-emerald-50 text-emerald-900 border-emerald-200',
    sky:     'bg-sky-50 text-sky-900 border-sky-200',
    amber:   'bg-amber-50 text-amber-900 border-amber-200',
    red:     'bg-red-50 text-red-900 border-red-200',
    teal:    'bg-teal-50 text-teal-900 border-teal-200',
    violet:  'bg-violet-50 text-violet-900 border-violet-200',
  };
  return (
    <div className={`rounded-lg border p-4 ${COLORS[color] ?? COLORS.indigo}`}>
      <p className="text-xs font-medium opacity-70">{label}</p>
      <p className="text-xl font-bold mt-0.5">{value}</p>
      {sub && <p className="text-xs opacity-60 mt-0.5">{sub}</p>}
    </div>
  );
}

// ─── Filter state ─────────────────────────────────────────────────────────────

interface Filters {
  dateFrom: string;
  dateTo: string;
  status: string;
  category_id: string;
  disciplina: string;
  payment_method: string;
}

const INIT_FILTERS: Filters = {
  dateFrom: '', dateTo: '', status: '',
  category_id: '', disciplina: '', payment_method: '',
};

// ─── Main component ───────────────────────────────────────────────────────────

export function FinanceReportsCharts({ data }: { data: FinanceReportData }) {
  const t = useTranslations('finances.reports');
  const tStatus = useTranslations('finances.status');
  const tPayments = useTranslations('finances.payments');

  const METHOD_LABEL: Record<string, string> = {
    transfer: tPayments('methodTransferShort'),
    check:    tPayments('methodCheck'),
    cash:     tPayments('methodCash'),
    card:     tPayments('methodCard'),
    other:    tPayments('methodOther'),
  };
  const STATUS_LABEL: Record<string, string> = {
    draft:     tStatus('draft'),
    submitted: tStatus('submitted'),
    approved:  tStatus('approved'),
    rejected:  tStatus('rejected'),
    paid:      tStatus('paid'),
    cancelled: tStatus('cancelled'),
  };

  const [filters, setFilters] = useState<Filters>(INIT_FILTERS);

  const set = (k: keyof Filters) => (
    e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>
  ) => setFilters(f => ({ ...f, [k]: e.target.value }));

  const activeCount = Object.values(filters).filter(Boolean).length;

  // Look up selected category name (for filtering payments by category)
  const selectedCategoryName = useMemo(
    () => data.all_categories.find(c => c.id === filters.category_id)?.name ?? '',
    [filters.category_id, data.all_categories]
  );

  // ── Filtered expenses ──────────────────────────────────────────────────────
  const filteredExpenses = useMemo(() => {
    return data.raw_expenses.filter(e => {
      if (filters.dateFrom && e.expense_date < filters.dateFrom) return false;
      if (filters.dateTo   && e.expense_date > filters.dateTo)   return false;
      if (filters.status      && e.status      !== filters.status)      return false;
      if (filters.category_id && e.category_id !== filters.category_id) return false;
      if (filters.disciplina  && e.disciplina  !== filters.disciplina)  return false;
      return true;
    });
  }, [data.raw_expenses, filters]);

  // ── Filtered payments ──────────────────────────────────────────────────────
  const filteredPayments = useMemo(() => {
    return data.raw_payments.filter(p => {
      if (filters.dateFrom       && p.payment_date       < filters.dateFrom)         return false;
      if (filters.dateTo         && p.payment_date       > filters.dateTo)           return false;
      if (filters.payment_method && p.payment_method     !== filters.payment_method) return false;
      if (filters.disciplina     && p.expense_disciplina !== filters.disciplina)     return false;
      if (filters.category_id    && p.expense_category_name !== selectedCategoryName) return false;
      return true;
    });
  }, [data.raw_payments, filters, selectedCategoryName]);

  // ── Derived chart data ─────────────────────────────────────────────────────

  const filteredTotal     = filteredExpenses.reduce((s, e) => s + e.amount, 0);
  const filteredPaidTotal = filteredPayments.reduce((s, p) => s + p.amount, 0);
  const filteredAvg       = filteredExpenses.length > 0 ? filteredTotal / filteredExpenses.length : 0;

  // By category
  const byCategoryFiltered = useMemo(() => {
    const map = new Map<string, { name: string; color: string | null; total: number; count: number }>();
    for (const e of filteredExpenses) {
      const prev = map.get(e.category_id) ?? { name: e.category_name, color: e.category_color, total: 0, count: 0 };
      map.set(e.category_id, { ...prev, total: prev.total + e.amount, count: prev.count + 1 });
    }
    return [...map.values()].sort((a, b) => b.total - a.total);
  }, [filteredExpenses]);

  // By status
  const byStatusFiltered = useMemo(() => {
    const map = new Map<string, { status: string; total: number; count: number }>();
    for (const e of filteredExpenses) {
      const prev = map.get(e.status) ?? { status: e.status, total: 0, count: 0 };
      map.set(e.status, { ...prev, total: prev.total + e.amount, count: prev.count + 1 });
    }
    return [...map.values()].sort((a, b) => b.total - a.total);
  }, [filteredExpenses]);

  // By disciplina
  const byDisciplinaFiltered = useMemo(() => {
    const map = new Map<string, { disciplina: string; total: number; count: number }>();
    for (const e of filteredExpenses) {
      const key = e.disciplina ?? 'Sin disciplina';
      const prev = map.get(key) ?? { disciplina: key, total: 0, count: 0 };
      map.set(key, { ...prev, total: prev.total + e.amount, count: prev.count + 1 });
    }
    return [...map.values()].sort((a, b) => b.total - a.total).slice(0, 15);
  }, [filteredExpenses]);

  // Monthly combined (gastos + pagos)
  const byMonthCombined = useMemo(() => {
    const map = new Map<string, { month: string; gastos: number; pagos: number }>();
    for (const e of filteredExpenses) {
      if (!e.expense_date) continue;
      const m = e.expense_date.slice(0, 7);
      const prev = map.get(m) ?? { month: m, gastos: 0, pagos: 0 };
      map.set(m, { ...prev, gastos: prev.gastos + e.amount });
    }
    for (const p of filteredPayments) {
      if (!p.payment_date) continue;
      const m = p.payment_date.slice(0, 7);
      const prev = map.get(m) ?? { month: m, gastos: 0, pagos: 0 };
      map.set(m, { ...prev, pagos: prev.pagos + p.amount });
    }
    return [...map.values()]
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-18)
      .map(r => ({ ...r, label: monthLabel(r.month) }));
  }, [filteredExpenses, filteredPayments]);

  // By payment method
  const byMethodFiltered = useMemo(() => {
    const map = new Map<string, { method: string; total: number; count: number }>();
    for (const p of filteredPayments) {
      const prev = map.get(p.payment_method) ?? { method: p.payment_method, total: 0, count: 0 };
      map.set(p.payment_method, { ...prev, total: prev.total + p.amount, count: prev.count + 1 });
    }
    return [...map.values()].sort((a, b) => b.total - a.total);
  }, [filteredPayments]);

  // Top 10 expenses (filtered)
  const topExpensesFiltered = useMemo(() =>
    [...filteredExpenses].sort((a, b) => b.amount - a.amount).slice(0, 10),
    [filteredExpenses]
  );

  // ── Static budget data ─────────────────────────────────────────────────────
  const { summary, by_budget } = data;
  const exercisedPct = summary.total_budget > 0
    ? Math.round((summary.total_exercised / summary.total_budget) * 100)
    : 0;

  const inputCls = 'w-full rounded border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-400';
  const labelCls = 'block text-xs font-medium text-gray-500 mb-1';

  return (
    <div className="space-y-6">

      {/* ── Filter panel ────────────────────────────────────────────────────── */}
      <div className="rounded-lg border border-indigo-100 bg-indigo-50/60 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
            </svg>
            <span className="text-xs font-semibold text-indigo-700">{t('filtersTitle')}</span>
            {activeCount > 0 && (
              <span className="rounded-full bg-indigo-500 px-2 py-0.5 text-[10px] font-bold text-white">
                {activeCount}
              </span>
            )}
          </div>
          {activeCount > 0 && (
            <button
              onClick={() => setFilters(INIT_FILTERS)}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-medium underline underline-offset-2"
            >
              {t('filterClear')}
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div>
            <label className={labelCls}>{t('filterDateFrom')}</label>
            <input type="date" value={filters.dateFrom} onChange={set('dateFrom')} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>{t('filterDateTo')}</label>
            <input type="date" value={filters.dateTo} onChange={set('dateTo')} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>{t('filterStatus')}</label>
            <select value={filters.status} onChange={set('status')} className={inputCls}>
              <option value="">{t('filterAllStatuses')}</option>
              {Object.entries(STATUS_LABEL).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>{t('filterCategory')}</label>
            <select value={filters.category_id} onChange={set('category_id')} className={inputCls}>
              <option value="">{t('filterAllCategories')}</option>
              {data.all_categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>{t('filterDiscipline')}</label>
            <select value={filters.disciplina} onChange={set('disciplina')} className={inputCls}>
              <option value="">{t('filterAllDisciplines')}</option>
              {data.all_disciplinas.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>{t('filterPaymentMethod')}</label>
            <select value={filters.payment_method} onChange={set('payment_method')} className={inputCls}>
              <option value="">{t('filterAllMethods')}</option>
              {Object.entries(METHOD_LABEL).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ── KPIs globales (presupuesto — estáticos) ───────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <KPICard label={t('kpiTotalBudget')}  value={fmtShort(summary.total_budget)} color="indigo" />
        <KPICard label={t('kpiExercised')}     value={fmtShort(summary.total_exercised)}
          sub={`${exercisedPct}%`} color="emerald" />
        <KPICard label={t('kpiAvailable')}     value={fmtShort(Math.max(0, summary.total_available))}
          color={summary.total_available < 0 ? 'red' : 'sky'} />
        <KPICard label={t('kpiPending')}       value={String(summary.pending_approval_count)}
          sub={fmtShort(summary.pending_approval_amount)} color="amber" />
        <KPICard label={t('kpiPaidGlobal')}    value={fmtShort(data.total_payments)}
          sub={`${data.payments_count}`} color="teal" />
        <KPICard label={t('kpiAthletes')}      value={String(summary.athlete_expenses_count)}
          sub={fmtShort(summary.athlete_expenses_total)} color="violet" />
      </div>

      {/* ── KPIs del conjunto filtrado ────────────────────────────────────────── */}
      <div className={`rounded-lg border p-4 ${activeCount > 0
        ? 'border-indigo-200 bg-white'
        : 'border-gray-100 bg-gray-50'}`}>
        <p className="text-xs font-semibold text-gray-500 mb-3">
          {activeCount > 0 ? t('activeResults') : t('allResults')}
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <p className="text-2xl font-bold text-gray-900">{filteredExpenses.length}</p>
            <p className="text-xs text-gray-500 mt-0.5">{t('expensesCount')}</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{fmt(filteredTotal)}</p>
            <p className="text-xs text-gray-500 mt-0.5">{t('totalExpenses')}</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">
              {filteredExpenses.length > 0 ? fmt(filteredAvg) : '—'}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">{t('avgExpense')}</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{fmt(filteredPaidTotal)}</p>
            <p className="text-xs text-gray-500 mt-0.5">{t('paymentsTotal', { count: filteredPayments.length })}</p>
          </div>
        </div>
      </div>

      {/* ── Barra de progreso presupuestal ───────────────────────────────────── */}
      <div className="rounded-lg border border-gray-200 bg-white p-5">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-gray-800">{t('execTitle')}</h3>
          <span className={`text-sm font-bold ${
            exercisedPct > 90 ? 'text-red-600' : exercisedPct > 70 ? 'text-amber-600' : 'text-emerald-600'
          }`}>
            {exercisedPct}%
          </span>
        </div>
        <div className="h-4 w-full bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              exercisedPct > 90 ? 'bg-red-500' : exercisedPct > 70 ? 'bg-amber-500' : 'bg-emerald-500'
            }`}
            style={{ width: `${Math.min(100, exercisedPct)}%` }}
          />
        </div>
        <div className="flex justify-between mt-1 text-xs text-gray-500">
          <span>{fmt(summary.total_exercised)} {t('execExercised')}</span>
          <span>{fmt(summary.total_budget)} {t('execTotal')}</span>
        </div>
      </div>

      {/* ── Tendencia mensual: Gastos + Pagos (filtrado) ──────────────────────── */}
      <ChartCard
        title={t('monthly')}
        subtitle={activeCount > 0 ? t('monthlySubFiltered') : t('monthlySubAll')}
      >
        {byMonthCombined.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">{t('noDataPeriod')}</p>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={byMonthCombined} margin={{ left: 0, right: 20, top: 8, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} />
              <YAxis tickFormatter={fmtShort} tick={{ fontSize: 10 }} />
              <Tooltip content={<CurrencyTooltip />} />
              <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="gastos" name={t('expensesLabel')} stroke="#6366f1"
                strokeWidth={2} dot={{ r: 3, fill: '#6366f1' }} activeDot={{ r: 5 }} />
              <Line type="monotone" dataKey="pagos" name={t('paymentsLabel')} stroke="#10b981"
                strokeWidth={2} dot={{ r: 3, fill: '#10b981' }} activeDot={{ r: 5 }} strokeDasharray="5 3" />
            </LineChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* ── Row 1: Por categoría (pie) + Por estado (barras) ─────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Pie: Por categoría */}
        <ChartCard title={t('byCategory')}
          subtitle={activeCount > 0 ? t('byCategorySubFiltered') : t('byCategorySubAll')}>
          {byCategoryFiltered.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">{t('noData')}</p>
          ) : (
            <div className="flex gap-4 items-center">
              <ResponsiveContainer width="50%" height={200}>
                <PieChart>
                  <Pie
                    data={byCategoryFiltered}
                    dataKey="total"
                    nameKey="name"
                    cx="50%" cy="50%"
                    innerRadius={50} outerRadius={80}
                    paddingAngle={2}
                  >
                    {byCategoryFiltered.map((c, i) => (
                      <Cell key={c.name} fill={c.color ?? PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: unknown) => fmt(Number(v))} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-1.5 overflow-hidden">
                {byCategoryFiltered.slice(0, 8).map((c, i) => {
                  const pct = filteredTotal > 0 ? Math.round((c.total / filteredTotal) * 100) : 0;
                  return (
                    <div key={c.name} className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: c.color ?? PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="text-xs text-gray-700 flex-1 truncate">{c.name}</span>
                      <span className="text-xs text-gray-400 shrink-0">{c.count}</span>
                      <span className="text-xs font-medium text-gray-600 shrink-0 w-8 text-right">{pct}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </ChartCard>

        {/* Barras: Por estado */}
        <ChartCard title={t('byStatus')}
          subtitle={activeCount > 0 ? t('byStatusSubFiltered') : t('byStatusSubAll')}>
          {byStatusFiltered.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">{t('noData')}</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={byStatusFiltered} layout="vertical"
                margin={{ left: 8, right: 50, top: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tickFormatter={fmtShort} tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="status" width={82}
                  tickFormatter={(v: string) => STATUS_LABEL[v] ?? v}
                  tick={{ fontSize: 10 }} />
                <Tooltip content={<CurrencyTooltip />} />
                <Bar dataKey="total" name={t('totalExpenses')} radius={[0, 3, 3, 0]}
                  label={{ position: 'right', formatter: (v: unknown) => fmtShort(Number(v)), fontSize: 10, fill: '#6b7280' }}>
                  {byStatusFiltered.map(s => (
                    <Cell key={s.status} fill={STATUS_COLORS[s.status] ?? '#6b7280'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* ── Por disciplina ────────────────────────────────────────────────────── */}
      {byDisciplinaFiltered.length > 0 && (
        <ChartCard title={t('byDiscipline')}
          subtitle={activeCount > 0 ? t('byDisciplineSubFiltered') : t('byDisciplineSubAll')}>
          <ResponsiveContainer width="100%" height={Math.max(220, byDisciplinaFiltered.length * 34)}>
            <BarChart data={byDisciplinaFiltered} layout="vertical"
              margin={{ left: 8, right: 90, top: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tickFormatter={fmtShort} tick={{ fontSize: 10 }} />
              <YAxis type="category" dataKey="disciplina" width={130}
                tick={{ fontSize: 10, fill: '#4b5563' }} />
              <Tooltip content={<CurrencyTooltip />} />
              <Bar dataKey="total" name={t('totalExpenses')} fill="#6366f1" radius={[0, 3, 3, 0]}
                label={{ position: 'right', formatter: (v: unknown) => fmtShort(Number(v)), fontSize: 10, fill: '#6b7280' }} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {/* ── Row 2: Métodos de pago (pie) + Presupuesto vs ejercido ───────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Pie: Métodos de pago (filtrado) */}
        <ChartCard title={t('paymentMethods')}
          subtitle={activeCount > 0 ? t('paymentMethodsSubFiltered') : t('paymentMethodsSubAll')}>
          {byMethodFiltered.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">{t('noPayments')}</p>
          ) : (
            <div className="flex gap-4 items-center">
              <ResponsiveContainer width="50%" height={200}>
                <PieChart>
                  <Pie data={byMethodFiltered} dataKey="total" nameKey="method"
                    cx="50%" cy="50%" outerRadius={80} paddingAngle={2}>
                    {byMethodFiltered.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: unknown) => fmt(Number(v))} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-2">
                {byMethodFiltered.map((m, i) => (
                  <div key={m.method} className="space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="text-xs text-gray-700 flex-1">
                        {METHOD_LABEL[m.method] ?? m.method}
                      </span>
                      <span className="text-xs font-semibold text-gray-900">{fmt(m.total)}</span>
                    </div>
                    <p className="text-xs text-gray-400 pl-4">{m.count} pago{m.count !== 1 ? 's' : ''}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </ChartCard>

        {/* Barras pareadas: Presupuesto vs ejercido (global) */}
        <ChartCard title={t('budgetVsExercised')} subtitle={t('budgetVsExercisedSub')}>
          {by_budget.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">{t('noBudgets')}</p>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(160, by_budget.length * 52)}>
              <BarChart data={by_budget} layout="vertical"
                margin={{ left: 8, right: 20, top: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tickFormatter={fmtShort} tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="name" width={160} tick={{ fontSize: 10 }} />
                <Tooltip content={<CurrencyTooltip />} />
                <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="total_amount" name={t('budgeted')}       fill="#e0e7ff" radius={[0, 2, 2, 0]} />
                <Bar dataKey="exercised"    name={t('exercisedLabel')} fill="#6366f1" radius={[0, 2, 2, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* ── Top 10 gastos (filtrado) ──────────────────────────────────────────── */}
      {topExpensesFiltered.length > 0 && (
        <ChartCard
          title={t('topExpenses', { count: Math.min(10, topExpensesFiltered.length) })}
          subtitle={activeCount > 0 ? t('topExpensesSubFiltered') : t('topExpensesSubAll')}
        >
          <div className="space-y-2">
            {topExpensesFiltered.map((e, i) => {
              const maxAmount = topExpensesFiltered[0].amount;
              const pct = maxAmount > 0 ? Math.round((e.amount / maxAmount) * 100) : 0;
              return (
                <div key={e.id} className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-400 w-4 shrink-0">{i + 1}</span>
                    <span className="text-xs text-gray-700 flex-1 truncate" title={e.title}>{e.title}</span>
                    {e.disciplina && (
                      <span className="text-xs px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded shrink-0">
                        {e.disciplina}
                      </span>
                    )}
                    <span className="text-xs px-1.5 py-0.5 bg-gray-50 text-gray-500 rounded shrink-0">
                      {e.category_name}
                    </span>
                    <ExpenseStatusBadge status={e.status as ExpenseStatus} />
                    <span className="text-xs font-semibold text-gray-900 shrink-0 min-w-[90px] text-right">
                      {fmt(e.amount)}
                    </span>
                  </div>
                  <div className="pl-6 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-400 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </ChartCard>
      )}

      {/* ── Gastos asociados a atletas (global) ──────────────────────────────── */}
      <div className="rounded-lg border border-teal-200 bg-teal-50 p-5">
        <h3 className="text-sm font-semibold text-teal-800 mb-3">{t('athleteExpenses')}</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <p className="text-2xl font-bold text-teal-900">{fmt(summary.athlete_expenses_total)}</p>
            <p className="text-xs text-teal-600 mt-0.5">{t('athleteTotal')}</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-teal-900">{summary.athlete_expenses_count}</p>
            <p className="text-xs text-teal-600 mt-0.5">{t('athleteCount')}</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-teal-900">
              {summary.athlete_expenses_count > 0
                ? fmt(summary.athlete_expenses_total / summary.athlete_expenses_count)
                : '$0'}
            </p>
            <p className="text-xs text-teal-600 mt-0.5">{t('athleteAvg')}</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-teal-900">
              {summary.total_exercised > 0
                ? `${Math.round((summary.athlete_expenses_total / summary.total_exercised) * 100)}%`
                : '0%'}
            </p>
            <p className="text-xs text-teal-600 mt-0.5">{t('athletePct')}</p>
          </div>
        </div>
      </div>

    </div>
  );
}
