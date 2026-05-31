/**
 * services/finance-reports.ts
 *
 * Read-only data fetching for the Finance Reports screen.
 * Uses the authenticated Supabase client (anon key + RLS).
 * Requires the authenticated user to have the `view_finances` permission
 * — the RLS policies on the finance tables enforce this server-side.
 *
 * All aggregations are performed client-side to minimise the number of
 * round-trips and avoid needing a PostgREST RPC function.
 */

import { supabase } from '@/lib/supabase';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type FinanceSummary = {
  total_budget:    number;   // sum of all active budget total_amounts
  total_exercised: number;   // expenses in approved + paid status
  total_available: number;   // total_budget - total_exercised
  total_payments:  number;   // sum of all recorded payments
  pending_count:   number;   // expenses in 'submitted' status
  pending_amount:  number;   // sum of submitted expenses
};

export type StatusRow = {
  status: string;
  total:  number;
  count:  number;
};

export type CategoryRow = {
  name:  string;
  color: string | null;
  total: number;
  count: number;
};

export type MethodRow = {
  method: string;
  total:  number;
  count:  number;
};

export type TopExpense = {
  id:             string;
  title:          string;
  amount:         number;
  status:         string;
  disciplina:     string | null;
  expense_date:   string | null;
  category_name:  string;
  category_color: string | null;
};

export type DisciplinaRow = {
  disciplina: string;
  total:      number;
  count:      number;
};

export type FinanceMobileReport = {
  summary:           FinanceSummary;
  by_status:         StatusRow[];
  by_category:       CategoryRow[];
  by_payment_method: MethodRow[];
  by_disciplina:     DisciplinaRow[];
  top_expenses:      TopExpense[];
  // Raw arrays for client-side period filtering
  raw_expenses:      TopExpense[];
  raw_payments:      { amount: number; payment_method: string; payment_date: string | null }[];
  fetched_at:        string;
};

// ---------------------------------------------------------------------------
// Internal types (raw DB rows)
// ---------------------------------------------------------------------------

type RawExpense = {
  id:           string;
  title:        string;
  amount:       number;
  status:       string;
  disciplina:   string | null;
  expense_date: string | null;
  category_id:  string;
  category:     { name: string; color: string | null } | { name: string; color: string | null }[] | null;
};

type RawPayment = {
  amount:         number;
  payment_method: string;
  payment_date:   string | null;
};

type RawBudget = {
  total_amount: number;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function categoryFromRow(
  raw: RawExpense['category'],
): { name: string; color: string | null } {
  if (!raw) return { name: 'Sin categoría', color: null };
  if (Array.isArray(raw)) return raw[0] ?? { name: 'Sin categoría', color: null };
  return raw;
}

// ---------------------------------------------------------------------------
// Main query
// ---------------------------------------------------------------------------

const EMPTY_REPORT: FinanceMobileReport = {
  summary: {
    total_budget:    0,
    total_exercised: 0,
    total_available: 0,
    total_payments:  0,
    pending_count:   0,
    pending_amount:  0,
  },
  by_status:         [],
  by_category:       [],
  by_payment_method: [],
  by_disciplina:     [],
  top_expenses:      [],
  raw_expenses:      [],
  raw_payments:      [],
  fetched_at:        new Date().toISOString(),
};

/**
 * Fetches all data needed for the Finance Reports screen in one concurrent
 * batch and aggregates it in memory.
 *
 * Returns EMPTY_REPORT on any error so the UI always has a stable shape.
 */
export async function getFinanceReport(): Promise<FinanceMobileReport> {
  try {
    const [budgetsRes, expensesRes, paymentsRes] = await Promise.all([
      supabase
        .from('finance_budgets')
        .select('total_amount')
        .eq('status', 'active'),

      supabase
        .from('finance_expenses')
        .select(
          'id, title, amount, status, disciplina, expense_date, category_id, ' +
          'category:finance_expense_categories(name, color)'
        ),

      supabase
        .from('finance_payments')
        .select('amount, payment_method, payment_date'),
    ]);

    const budgets  = (budgetsRes.data  ?? []) as RawBudget[];
    const expenses = (expensesRes.data ?? []) as unknown as RawExpense[];
    const payments = (paymentsRes.data ?? []) as RawPayment[];

    // ── Summary ──────────────────────────────────────────────────────────────
    const total_budget    = budgets.reduce((s, b) => s + (b.total_amount ?? 0), 0);
    const exercised       = expenses.filter((e) => ['approved', 'paid'].includes(e.status));
    const pending         = expenses.filter((e) => e.status === 'submitted');
    const total_exercised = exercised.reduce((s, e) => s + e.amount, 0);
    const total_payments  = payments.reduce((s, p) => s + p.amount, 0);

    // ── By status ─────────────────────────────────────────────────────────────
    const statusMap = new Map<string, StatusRow>();
    for (const e of expenses) {
      const prev = statusMap.get(e.status) ?? { status: e.status, total: 0, count: 0 };
      statusMap.set(e.status, { ...prev, total: prev.total + e.amount, count: prev.count + 1 });
    }
    const by_status = [...statusMap.values()].sort((a, b) => b.total - a.total);

    // ── By category ───────────────────────────────────────────────────────────
    const catMap = new Map<string, CategoryRow & { key: string }>();
    for (const e of expenses) {
      const cat = categoryFromRow(e.category);
      const key = e.category_id;
      const prev = catMap.get(key) ?? { key, name: cat.name, color: cat.color, total: 0, count: 0 };
      catMap.set(key, { ...prev, total: prev.total + e.amount, count: prev.count + 1 });
    }
    const by_category = [...catMap.values()]
      .sort((a, b) => b.total - a.total)
      .slice(0, 8)
      .map(({ key: _k, ...rest }) => rest);

    // ── By payment method ─────────────────────────────────────────────────────
    const methodMap = new Map<string, MethodRow>();
    for (const p of payments) {
      const prev = methodMap.get(p.payment_method) ?? { method: p.payment_method, total: 0, count: 0 };
      methodMap.set(p.payment_method, { ...prev, total: prev.total + p.amount, count: prev.count + 1 });
    }
    const by_payment_method = [...methodMap.values()].sort((a, b) => b.total - a.total);

    // ── By disciplina ─────────────────────────────────────────────────────────
    const discMap = new Map<string, DisciplinaRow>();
    for (const e of expenses) {
      const key = e.disciplina ?? 'Sin disciplina';
      const prev = discMap.get(key) ?? { disciplina: key, total: 0, count: 0 };
      discMap.set(key, { ...prev, total: prev.total + e.amount, count: prev.count + 1 });
    }
    const by_disciplina = [...discMap.values()]
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    // ── Top expenses ──────────────────────────────────────────────────────────
    // All expenses mapped (for raw access + top 10)
    const allMapped: TopExpense[] = expenses.map((e) => {
      const cat = categoryFromRow(e.category);
      return {
        id:             e.id,
        title:          e.title,
        amount:         e.amount,
        status:         e.status,
        disciplina:     e.disciplina,
        expense_date:   e.expense_date,
        category_name:  cat.name,
        category_color: cat.color,
      };
    });

    const top_expenses = [...allMapped].sort((a, b) => b.amount - a.amount).slice(0, 10);

    const raw_payments = payments.map(p => ({
      amount:         p.amount,
      payment_method: p.payment_method,
      payment_date:   p.payment_date,
    }));

    return {
      summary: {
        total_budget,
        total_exercised,
        total_available: total_budget - total_exercised,
        total_payments,
        pending_count:  pending.length,
        pending_amount: pending.reduce((s, e) => s + e.amount, 0),
      },
      by_status,
      by_category,
      by_payment_method,
      by_disciplina,
      top_expenses,
      raw_expenses:  allMapped,
      raw_payments,
      fetched_at: new Date().toISOString(),
    };
  } catch (err) {
    console.warn('[finance-reports] getFinanceReport error:', err);
    return EMPTY_REPORT;
  }
}
