'use client';

import { useState, useMemo, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import type { FinanceReportData } from '@/lib/finance/actions';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (v: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(v);

const fmtShort = (v: number) => {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
};

const pad = (n: number) => String(n).padStart(2, '0');
const fmtDate = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

type PeriodKey = 'week' | 'biweek' | 'month' | 'prev-month' | 'custom';

function getPeriodDates(p: PeriodKey): { from: string; to: string } {
  const today = new Date();
  if (p === 'week') {
    const day = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - (day === 0 ? 6 : day - 1));
    return { from: fmtDate(monday), to: fmtDate(today) };
  }
  if (p === 'biweek') {
    const d = today.getDate();
    const y = today.getFullYear();
    const m = pad(today.getMonth() + 1);
    if (d <= 15) {
      return { from: `${y}-${m}-01`, to: `${y}-${m}-15` };
    }
    const last = new Date(y, today.getMonth() + 1, 0).getDate();
    return { from: `${y}-${m}-16`, to: `${y}-${m}-${last}` };
  }
  if (p === 'month') {
    const y = today.getFullYear();
    const m = pad(today.getMonth() + 1);
    return { from: `${y}-${m}-01`, to: fmtDate(today) };
  }
  if (p === 'prev-month') {
    const prev = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const last = new Date(today.getFullYear(), today.getMonth(), 0).getDate();
    const y = prev.getFullYear();
    const m = pad(prev.getMonth() + 1);
    return { from: `${y}-${m}-01`, to: `${y}-${m}-${last}` };
  }
  return { from: '', to: fmtDate(today) };
}

const PIE_COLORS = [
  '#6366f1','#10b981','#f59e0b','#3b82f6','#ec4899',
  '#8b5cf6','#14b8a6','#ef4444','#f97316','#6b7280',
];

const STATUS_COLORS: Record<string, string> = {
  draft: '#94a3b8', submitted: '#f59e0b', approved: '#10b981',
  rejected: '#ef4444', paid: '#3b82f6', cancelled: '#6b7280',
};
const STATUS_LABELS: Record<string, string> = {
  draft: 'Borrador', submitted: 'En revisión', approved: 'Aprobado',
  rejected: 'Rechazado', paid: 'Pagado', cancelled: 'Cancelado',
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function KPI({ label, value, sub, color = 'indigo', large = false }: {
  label: string; value: string; sub?: string; color?: string; large?: boolean;
}) {
  const cls: Record<string, string> = {
    indigo:  'bg-indigo-50 border-indigo-200 text-indigo-900',
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-900',
    sky:     'bg-sky-50 border-sky-200 text-sky-900',
    amber:   'bg-amber-50 border-amber-200 text-amber-900',
    red:     'bg-red-50 border-red-200 text-red-900',
    teal:    'bg-teal-50 border-teal-200 text-teal-900',
    violet:  'bg-violet-50 border-violet-200 text-violet-900',
    gray:    'bg-gray-50 border-gray-200 text-gray-900',
  };
  return (
    <div className={`rounded-xl border p-4 ${cls[color] ?? cls.indigo} print:border print:shadow-none`}>
      <p className="text-xs font-medium opacity-60 uppercase tracking-wide">{label}</p>
      <p className={`font-bold mt-1 ${large ? 'text-2xl' : 'text-xl'}`}>{value}</p>
      {sub && <p className="text-xs opacity-50 mt-0.5">{sub}</p>}
    </div>
  );
}

function Section({ title, children, className = '' }: {
  title: string; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={`rounded-xl border border-gray-200 bg-white p-5 print:border print:shadow-none ${className}`}>
      <h3 className="text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wide">{title}</h3>
      {children}
    </div>
  );
}

function CurrTooltip({ active, payload, label }: {
  active?: boolean; payload?: Array<{ color: string; name: string; value: number }>; label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-xs">
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }}>{p.name}: {fmt(p.value)}</p>
      ))}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function FinancePeriodReport({ data }: { data: FinanceReportData }) {
  const [period,   setPeriod]   = useState<PeriodKey>('month');
  const [dateFrom, setDateFrom] = useState(() => getPeriodDates('month').from);
  const [dateTo,   setDateTo]   = useState(() => getPeriodDates('month').to);

  const selectPreset = useCallback((p: PeriodKey) => {
    setPeriod(p);
    if (p !== 'custom') {
      const { from, to } = getPeriodDates(p);
      setDateFrom(from);
      setDateTo(to);
    }
  }, []);

  const handlePrint = () => window.print();

  // ─── Filter expenses/payments by period ────────────────────────────────────
  const expenses = useMemo(() =>
    data.raw_expenses.filter(e =>
      (!dateFrom || e.expense_date >= dateFrom) &&
      (!dateTo   || e.expense_date <= dateTo)
    ), [data.raw_expenses, dateFrom, dateTo]);

  const payments = useMemo(() =>
    data.raw_payments.filter(p =>
      (!dateFrom || p.payment_date >= dateFrom) &&
      (!dateTo   || p.payment_date <= dateTo)
    ), [data.raw_payments, dateFrom, dateTo]);

  // ─── KPI calculations ──────────────────────────────────────────────────────
  const totalExpenses   = useMemo(() => expenses.reduce((s, e) => s + e.amount, 0), [expenses]);
  const paidExpenses    = useMemo(() => expenses.filter(e => e.status === 'paid').reduce((s, e) => s + e.amount, 0), [expenses]);
  const pendingExpenses = useMemo(() => expenses.filter(e => ['submitted','approved'].includes(e.status)).reduce((s, e) => s + e.amount, 0), [expenses]);
  const totalPayments   = useMemo(() => payments.reduce((s, p) => s + p.amount, 0), [payments]);

  const totalBudget   = data.summary.total_budget;
  const totalExercised = data.summary.total_exercised;
  const notExercised  = Math.max(0, totalBudget - totalExercised);
  const toExercise    = data.summary.pending_approval_amount ?? 0;
  const exercisedPct  = totalBudget > 0 ? Math.round((totalExercised / totalBudget) * 100) : 0;
  const periodPct     = totalBudget > 0 ? Math.round((totalExpenses / totalBudget) * 100) : 0;

  // ─── By category ───────────────────────────────────────────────────────────
  const byCategory = useMemo(() => {
    const map = new Map<string, { name: string; color: string | null; total: number; count: number }>();
    for (const e of expenses) {
      const prev = map.get(e.category_id) ?? { name: e.category_name, color: e.category_color, total: 0, count: 0 };
      map.set(e.category_id, { ...prev, total: prev.total + e.amount, count: prev.count + 1 });
    }
    return [...map.values()].sort((a, b) => b.total - a.total).slice(0, 10);
  }, [expenses]);

  // ─── By status ─────────────────────────────────────────────────────────────
  const byStatus = useMemo(() => {
    const map = new Map<string, { status: string; total: number; count: number }>();
    for (const e of expenses) {
      const prev = map.get(e.status) ?? { status: e.status, total: 0, count: 0 };
      map.set(e.status, { ...prev, total: prev.total + e.amount, count: prev.count + 1 });
    }
    return [...map.values()].sort((a, b) => b.total - a.total);
  }, [expenses]);

  // ─── Top 10 expenses ───────────────────────────────────────────────────────
  const top10 = useMemo(() =>
    [...expenses].sort((a, b) => b.amount - a.amount).slice(0, 10),
    [expenses]);

  // ─── Budget vs exercised by budget ─────────────────────────────────────────
  const budgetChart = data.by_budget.map(b => ({
    name: b.name,
    Presupuesto: b.total_amount,
    Ejercido:    b.exercised,
    Disponible:  Math.max(0, b.total_amount - b.exercised),
  }));

  const presets: { key: PeriodKey; label: string }[] = [
    { key: 'week',       label: 'Esta semana'  },
    { key: 'biweek',     label: 'Esta quincena'},
    { key: 'month',      label: 'Este mes'     },
    { key: 'prev-month', label: 'Mes anterior' },
    { key: 'custom',     label: 'Personalizado'},
  ];

  const formatPeriodLabel = () => {
    if (!dateFrom && !dateTo) return 'Todos los períodos';
    if (dateFrom && dateTo) return `${dateFrom} → ${dateTo}`;
    if (dateFrom) return `Desde ${dateFrom}`;
    return `Hasta ${dateTo}`;
  };

  return (
    <>
      {/* ── Print CSS ───────────────────────────────────────────────────────── */}
      <style>{`
        @media print {
          @page { size: A4; margin: 1.5cm; }
          body * { visibility: hidden; }
          #periodic-report, #periodic-report * { visibility: visible; }
          #periodic-report { position: absolute; top: 0; left: 0; width: 100%; }
          .no-print { display: none !important; }
          .print-break { page-break-before: always; }
          .recharts-wrapper { width: 100% !important; }
        }
      `}</style>

      {/* ── Controls (no-print on print) ─────────────────────────────────────── */}
      <div className="no-print space-y-4">
        {/* Period selector */}
        <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-4">
          <div className="flex flex-wrap items-center gap-3 mb-3">
            <span className="text-xs font-semibold text-indigo-700 uppercase tracking-wide">Período</span>
            <div className="flex flex-wrap gap-2">
              {presets.map(p => (
                <button
                  key={p.key}
                  onClick={() => selectPreset(p.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    period === p.key
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white text-indigo-600 border border-indigo-200 hover:bg-indigo-50'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Custom date pickers */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-xs text-indigo-600 font-medium">Desde</label>
              <input
                type="date"
                value={dateFrom}
                onChange={e => { setDateFrom(e.target.value); setPeriod('custom'); }}
                className="rounded border border-indigo-200 bg-white px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-indigo-600 font-medium">Hasta</label>
              <input
                type="date"
                value={dateTo}
                onChange={e => { setDateTo(e.target.value); setPeriod('custom'); }}
                className="rounded border border-indigo-200 bg-white px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
              />
            </div>
            <span className="text-xs text-indigo-500 font-medium">{expenses.length} gastos · {formatPeriodLabel()}</span>
          </div>
        </div>

        {/* Print button */}
        <div className="flex justify-end">
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Imprimir / Exportar PDF
          </button>
        </div>
      </div>

      {/* ── Printable report ─────────────────────────────────────────────────── */}
      <div id="periodic-report" className="space-y-6">

        {/* Report header (shown on print) */}
        <div className="hidden print:block mb-6 pb-4 border-b border-gray-300">
          <p className="text-xs text-gray-400 uppercase tracking-wider">AO Deportes · Reporte Financiero</p>
          <h2 className="text-2xl font-bold text-gray-900 mt-1">Reporte Periódico de Finanzas</h2>
          <p className="text-sm text-gray-500 mt-0.5">{formatPeriodLabel()} · Generado el {new Date().toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>

        {/* ── KPIs del período ───────────────────────────────────────────────── */}
        <div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Indicadores del período · {formatPeriodLabel()}
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <KPI label="Gastos del período"   value={fmtShort(totalExpenses)}  sub={`${expenses.length} registros`} color="indigo" large />
            <KPI label="Pagos realizados"     value={fmtShort(totalPayments)}  sub={`${payments.length} pagos`}    color="teal" />
            <KPI label="Pendientes de pago"   value={fmtShort(pendingExpenses)} sub="Aprobados sin pagar"           color="amber" />
            <KPI label="% del presupuesto"    value={`${periodPct}%`}           sub={`${fmtShort(totalBudget)} total`} color={periodPct > 90 ? 'red' : 'emerald'} />
            <KPI label="Presupuesto no ejercido" value={fmtShort(notExercised)} sub="Global disponible"            color="sky" />
            <KPI label="Por ejercer"          value={fmtShort(toExercise)}      sub="En revisión/aprobados"        color="violet" />
          </div>
        </div>

        {/* ── Barra de ejecución presupuestal ───────────────────────────────── */}
        <Section title="Ejecución presupuestal global">
          <div className="space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold text-gray-700">Presupuesto total: {fmt(totalBudget)}</span>
              <span className={`font-bold text-lg ${exercisedPct > 90 ? 'text-red-600' : exercisedPct > 70 ? 'text-amber-500' : 'text-emerald-600'}`}>
                {exercisedPct}% ejercido
              </span>
            </div>
            <div className="h-5 w-full bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${
                  exercisedPct > 90 ? 'bg-red-500' : exercisedPct > 70 ? 'bg-amber-500' : 'bg-emerald-500'
                }`}
                style={{ width: `${Math.min(100, exercisedPct)}%` }}
              />
            </div>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="rounded-lg bg-emerald-50 p-3">
                <p className="text-xs text-emerald-600 font-medium">Ejercido</p>
                <p className="text-xl font-bold text-emerald-800">{fmt(totalExercised)}</p>
              </div>
              <div className="rounded-lg bg-sky-50 p-3">
                <p className="text-xs text-sky-600 font-medium">Disponible</p>
                <p className="text-xl font-bold text-sky-800">{fmt(Math.max(0, notExercised))}</p>
              </div>
              <div className="rounded-lg bg-amber-50 p-3">
                <p className="text-xs text-amber-600 font-medium">Por ejercer</p>
                <p className="text-xl font-bold text-amber-800">{fmt(toExercise)}</p>
              </div>
            </div>
          </div>
        </Section>

        {/* ── Presupuesto vs Ejercido por presupuesto ───────────────────────── */}
        {budgetChart.length > 0 && (
          <Section title="Presupuesto vs. Ejercido por presupuesto">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={budgetChart} layout="vertical" margin={{ left: 8, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" tickFormatter={fmtShort} tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 10 }} />
                <Tooltip content={<CurrTooltip />} />
                <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Presupuesto" fill="#c7d2fe" radius={[0, 4, 4, 0]} />
                <Bar dataKey="Ejercido"    fill="#6366f1" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Section>
        )}

        {/* ── Gastos por categoría ─────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Bar chart */}
          <Section title={`Gastos por categoría — ${formatPeriodLabel()}`}>
            {byCategory.length === 0 ? (
              <div className="h-40 flex items-center justify-center text-sm text-gray-400">
                Sin gastos en el período seleccionado
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={byCategory} layout="vertical" margin={{ left: 4, right: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis type="number" tickFormatter={fmtShort} tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 10 }} />
                  <Tooltip
                    formatter={(v: unknown) => [fmt(Number(v)), 'Total']}
                    labelStyle={{ fontWeight: 600, color: '#374151' }}
                    contentStyle={{ fontSize: 12, border: '1px solid #e5e7eb', borderRadius: 8 }}
                  />
                  <Bar dataKey="total" radius={[0, 4, 4, 0]}>
                    {byCategory.map((entry, i) => (
                      <Cell
                        key={i}
                        fill={entry.color ?? PIE_COLORS[i % PIE_COLORS.length]}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </Section>

          {/* Pie chart */}
          <Section title="Distribución del gasto">
            {byCategory.length === 0 ? (
              <div className="h-40 flex items-center justify-center text-sm text-gray-400">
                Sin datos en el período
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={byCategory}
                    dataKey="total"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    label={({ name, percent }: { name?: string; percent?: number }) =>
                      (percent ?? 0) > 0.05 ? `${((percent ?? 0) * 100).toFixed(0)}%` : ''
                    }
                    labelLine={false}
                  >
                    {byCategory.map((entry, i) => (
                      <Cell
                        key={i}
                        fill={entry.color ?? PIE_COLORS[i % PIE_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: unknown) => fmt(Number(v))} />
                  <Legend
                    iconSize={10}
                    wrapperStyle={{ fontSize: 11 }}
                    formatter={(value, entry) => {
                      const d = byCategory.find(c => c.name === value);
                      return `${value} — ${fmtShort(d?.total ?? 0)}`;
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </Section>
        </div>

        {/* ── Gastos por estado ─────────────────────────────────────────────── */}
        {byStatus.length > 0 && (
          <Section title="Gastos por estado de flujo">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {byStatus.map(s => (
                <div
                  key={s.status}
                  className="rounded-lg border p-3 text-center"
                  style={{ borderColor: `${STATUS_COLORS[s.status]}40`, backgroundColor: `${STATUS_COLORS[s.status]}10` }}
                >
                  <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: STATUS_COLORS[s.status] }}>
                    {STATUS_LABELS[s.status] ?? s.status}
                  </p>
                  <p className="text-lg font-bold text-gray-900 mt-0.5">{fmtShort(s.total)}</p>
                  <p className="text-[11px] text-gray-400">{s.count} registros</p>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* ── Top 10 principales gastos ─────────────────────────────────────── */}
        <Section title={`Principales gastos del período — Top ${Math.min(10, top10.length)}`} className="print-break">
          {top10.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">Sin gastos en el período seleccionado</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-xs text-gray-500 uppercase tracking-wide">
                    <th className="text-left py-2 pr-4">#</th>
                    <th className="text-left py-2 pr-4">Concepto</th>
                    <th className="text-left py-2 pr-4">Categoría</th>
                    <th className="text-left py-2 pr-4">Disciplina</th>
                    <th className="text-left py-2 pr-4">Estado</th>
                    <th className="text-right py-2">Monto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {top10.map((e, i) => (
                    <tr key={e.id} className="hover:bg-gray-50">
                      <td className="py-2.5 pr-4 text-gray-400 font-medium">{i + 1}</td>
                      <td className="py-2.5 pr-4">
                        <p className="font-medium text-gray-800 truncate max-w-[200px]">{e.title}</p>
                      </td>
                      <td className="py-2.5 pr-4">
                        <span
                          className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium"
                          style={{
                            backgroundColor: `${e.category_color ?? '#6366f1'}20`,
                            color: e.category_color ?? '#6366f1',
                          }}
                        >
                          {e.category_name}
                        </span>
                      </td>
                      <td className="py-2.5 pr-4 text-xs text-gray-500">{e.disciplina ?? '—'}</td>
                      <td className="py-2.5 pr-4">
                        <span
                          className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium"
                          style={{
                            backgroundColor: `${STATUS_COLORS[e.status] ?? '#6b7280'}20`,
                            color: STATUS_COLORS[e.status] ?? '#6b7280',
                          }}
                        >
                          {STATUS_LABELS[e.status] ?? e.status}
                        </span>
                      </td>
                      <td className="py-2.5 text-right font-bold text-gray-900">{fmt(e.amount)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-300">
                    <td colSpan={5} className="py-2.5 text-sm font-semibold text-gray-600">
                      Total top {top10.length} gastos
                    </td>
                    <td className="py-2.5 text-right text-sm font-bold text-gray-900">
                      {fmt(top10.reduce((s, e) => s + e.amount, 0))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </Section>

        {/* Print footer */}
        <div className="hidden print:flex justify-between items-center pt-4 border-t border-gray-200 text-xs text-gray-400 mt-8">
          <span>AO Deportes — Reporte Financiero Periódico</span>
          <span>{new Date().toLocaleDateString('es-MX')}</span>
        </div>

      </div>
    </>
  );
}
