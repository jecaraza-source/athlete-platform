/**
 * tests/finance/finance-module.test.ts
 *
 * Integration tests — Finance Module
 * ───────────────────────────────────
 * Strategy: all Supabase calls are intercepted by an in-memory table proxy that
 * mimics the real query builder API.  RBAC and next/cache are stubbed.
 *
 * Covers:
 *  1.  Expense Category — create (name validation, duplicate guard)
 *  2.  Budgets — create, update, cancel, delete lifecycle
 *  3.  Budget Items — create, update, delete
 *  4.  Expenses — create, full edit (draft/rejected), partial edit (non-draft)
 *  5.  Expense delete — allowed on draft/cancelled only
 *  6.  Approval workflow — full happy path: draft → submitted → approved → paid
 *  7.  Approval workflow — rejection paths (submitted→rejected, approved→rejected)
 *  8.  Approval workflow — cancel from any eligible state
 *  9.  Approval workflow — invalid transitions are blocked
 * 10.  Suppliers — create, update, deactivate, delete
 * 11.  Payments — create, update, delete
 * 12.  Permission guards — manage_finances vs approve_finances
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';

// ─── Mocks (must be declared BEFORE importing the modules under test) ─────────

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

vi.mock('@/lib/rbac/server', () => ({
  assertPermission: vi.fn().mockResolvedValue(null),   // null = authorised
  getCurrentUser: vi.fn().mockResolvedValue({
    authUserId: 'auth-admin-001',
    profile: { id: 'profile-admin-001', first_name: 'Finance', last_name: 'Admin' },
    roles: [],
    permissions: new Set([
      'view_finances', 'manage_finances', 'approve_finances', 'view_finance_reports',
    ]),
  }),
}));

vi.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: { from: vi.fn() },
}));

// ─── Stable test IDs ──────────────────────────────────────────────────────────

// All IDs must be proper v4 UUIDs — the newer Zod version enforces the
// version digit [1-8] and variant [89abAB] in addition to the hex format.
// crypto.randomUUID() always produces a valid RFC 4122 v4 UUID.
const IDS = {
  admin:      crypto.randomUUID(),
  category:   crypto.randomUUID(),
  budget:     crypto.randomUUID(),
  budgetItem: crypto.randomUUID(),
  expense:    crypto.randomUUID(),
  expense2:   crypto.randomUUID(),
  supplier:   crypto.randomUUID(),
  payment:    crypto.randomUUID(),
  approval:   crypto.randomUUID(),
};

// ─── In-memory database ───────────────────────────────────────────────────────

type Row = Record<string, unknown>;

const db: Record<string, Row[]> = {
  finance_expense_categories: [],
  finance_budgets:            [],
  finance_budget_items:       [],
  finance_expenses:           [],
  finance_approvals:          [],
  finance_suppliers:          [],
  finance_payments:           [],
  finance_activity_log:       [],
};

function resetDb(): void {
  for (const key of Object.keys(db)) db[key] = [];
}

// ─── Table proxy ──────────────────────────────────────────────────────────────
// Implements the subset of the Supabase query builder that the finance actions
// actually use, without pulling in the real SDK.

function makeTableProxy(table: string) {
  const filters: Record<string, unknown> = {};
  const inFilters: Record<string, unknown[]> = {};
  let op: 'select' | 'insert' | 'update' | 'delete' | 'upsert' = 'select';
  let opData: Row | Row[] | null = null;
  let afterInsert = false;   // tracks .insert().select().single() chain
  let insertedRow: Row | null = null;

  function rows(): Row[] {
    return db[table] ?? [];
  }

  function setRows(r: Row[]): void {
    db[table] = r;
  }

  function matching(): Row[] {
    return rows().filter((row) => {
      for (const [k, v] of Object.entries(filters)) {
        if (row[k] !== v) return false;
      }
      for (const [k, vals] of Object.entries(inFilters)) {
        if (!vals.includes(row[k] as never)) return false;
      }
      return true;
    });
  }

  function execute(): { data: Row | Row[] | null; error: null | { message: string } } {
    switch (op) {
      case 'select':
        return { data: matching(), error: null };

      case 'insert': {
        const newRows = Array.isArray(opData) ? opData : [opData as Row];
        const withIds = newRows.map((r) => ({ id: crypto.randomUUID(), ...r }));
        setRows([...rows(), ...withIds]);
        insertedRow = withIds[0] ?? null;
        return { data: insertedRow, error: null };
      }

      case 'update':
        setRows(rows().map((r) =>
          Object.entries(filters).every(([k, v]) => r[k] === v)
            ? { ...r, ...(opData as Row) }
            : r
        ));
        return { data: null, error: null };

      case 'delete':
        setRows(rows().filter((r) =>
          !Object.entries(filters).every(([k, v]) => r[k] === v)
        ));
        return { data: null, error: null };

      case 'upsert': {
        const r = opData as Row;
        setRows([...rows(), { id: crypto.randomUUID(), ...r }]);
        return { data: r, error: null };
      }
    }
  }

  // proxy object — each method returns `proxy` for chaining
  const proxy: Record<string, unknown> = {};

  proxy.select   = (_cols?: string) => { afterInsert = false; return proxy; };
  proxy.order    = () => proxy;
  proxy.limit    = () => proxy;
  proxy.ilike    = () => proxy;

  proxy.eq = (k: string, v: unknown) => {
    filters[k] = v;
    return proxy;
  };

  proxy.in = (k: string, vals: unknown[]) => {
    inFilters[k] = vals;
    return proxy;
  };

  proxy.update = (data: Row) => {
    op = 'update';
    opData = data;
    return proxy;
  };

  proxy.insert = (data: Row | Row[]) => {
    op = 'insert';
    opData = data;
    afterInsert = true;
    return proxy;
  };

  proxy.delete = () => {
    op = 'delete';
    return proxy;
  };

  // .insert(...).select('id').single() pattern
  proxy.single = async () => {
    const result = execute();
    if (afterInsert && insertedRow) {
      return { data: insertedRow, error: null };
    }
    const found = matching();
    return found.length > 0
      ? { data: found[0], error: null }
      : { data: null, error: { message: 'No rows found' } };
  };

  proxy.maybeSingle = async () => {
    execute(); // ensure insert/update runs first if pending
    const found = matching();
    return { data: found[0] ?? null, error: null };
  };

  // Awaiting the query directly (e.g. `const { data } = await supabase.from(...).select(...)`)
  proxy.then = (resolve: (v: ReturnType<typeof execute>) => void) => {
    resolve(execute());
  };

  return proxy;
}

// ─── Imports of code under test ───────────────────────────────────────────────

import { supabaseAdmin } from '@/lib/supabase-admin';
import { assertPermission, getCurrentUser } from '@/lib/rbac/server';

import {
  createExpenseCategory,
  createBudget, updateBudget, cancelBudget, deleteBudget,
  createBudgetItem, updateBudgetItem, deleteBudgetItem,
  createExpense, updateExpense, deleteExpense,
  submitExpense, processApproval,
  createSupplier, updateSupplier, deactivateSupplier, deleteSupplier,
  createPayment, updatePayment, deletePayment,
} from '@/lib/finance/actions';

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  resetDb();

  vi.mocked(supabaseAdmin.from).mockImplementation(
    (table: string) => makeTableProxy(table) as unknown as ReturnType<typeof supabaseAdmin.from>
  );

  // Default: fully authorised admin user
  vi.mocked(assertPermission).mockResolvedValue(null);
  vi.mocked(getCurrentUser).mockResolvedValue({
    authUserId: 'auth-admin-001',
    profile: { id: IDS.admin, first_name: 'Finance', last_name: 'Admin', email: 'admin@test.com', role: 'admin' },
    roles: [],
    permissions: new Set([
      'view_finances', 'manage_finances', 'approve_finances', 'view_finance_reports',
    ]),
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function makeBudgetFd(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData();
  fd.set('name',         overrides.name         ?? 'Presupuesto 2025');
  fd.set('fiscal_year',  overrides.fiscal_year  ?? '2025');
  fd.set('total_amount', overrides.total_amount ?? '1000000');
  fd.set('start_date',   overrides.start_date   ?? '2025-01-01');
  fd.set('end_date',     overrides.end_date     ?? '2025-12-31');
  fd.set('status',       overrides.status       ?? 'active');
  // description and notes are optional but the schema rejects null;
  // set them to empty string so formData.get() returns '' not null.
  fd.set('description',  overrides.description  ?? '');
  fd.set('notes',        overrides.notes        ?? '');
  return fd;
}

function makeExpenseFd(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData();
  fd.set('category_id',    overrides.category_id  ?? IDS.category);
  fd.set('title',          overrides.title        ?? 'Uniformes JUDO');
  fd.set('amount',         overrides.amount       ?? '5000');
  fd.set('expense_date',   overrides.expense_date ?? '2025-03-15');
  // Always set optional strings to '' so formData.get() returns '' not null.
  // z.string().optional() in Zod rejects null; undefined and '' are both fine.
  fd.set('description',    overrides.description    ?? '');
  fd.set('notes',          overrides.notes          ?? '');
  fd.set('invoice_number', overrides.invoice_number ?? '');
  if (overrides.disciplina)  fd.set('disciplina',  overrides.disciplina);
  if (overrides.supplier_id) fd.set('supplier_id', overrides.supplier_id);
  return fd;
}

function makeSupplierFd(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData();
  fd.set('name', overrides.name ?? 'Deportes Olímpicos SA');
  if (overrides.rfc)   fd.set('rfc',   overrides.rfc);
  if (overrides.email) fd.set('email', overrides.email);
  if (overrides.phone) fd.set('phone', overrides.phone);
  return fd;
}

function makePaymentFd(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData();
  fd.set('expense_id',     overrides.expense_id     ?? IDS.expense);
  fd.set('amount',         overrides.amount         ?? '5000');
  fd.set('payment_date',   overrides.payment_date   ?? '2025-03-20');
  fd.set('payment_method', overrides.payment_method ?? 'transfer');
  if (overrides.reference) fd.set('reference', overrides.reference);
  return fd;
}

function seedExpense(status: string, id = IDS.expense): void {
  db.finance_expenses.push({
    id,
    category_id:  IDS.category,
    title:        'Uniformes JUDO',
    amount:       5000,
    expense_date: '2025-03-15',
    status,
    created_by:   IDS.admin,
    disciplina:   null,
    supplier_id:  null,
    athlete_id:   null,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. EXPENSE CATEGORIES
// ─────────────────────────────────────────────────────────────────────────────

describe('1. Expense categories — create', () => {
  it('creates a category and returns { error: null, id }', async () => {
    const fd = new FormData();
    fd.set('name', 'Transporte');
    fd.set('color', '#3b82f6');

    const result = await createExpenseCategory(fd);

    expect(result.error).toBeNull();
    expect(result.id).toBeDefined();
  });

  it('persists the category in the DB with correct fields', async () => {
    const fd = new FormData();
    fd.set('name', 'Hospedaje');
    fd.set('description', 'Costos de hospedaje en competencias');
    fd.set('color', '#10b981');

    await createExpenseCategory(fd);

    const row = db.finance_expense_categories[0];
    expect(row.name).toBe('Hospedaje');
    expect(row.description).toBe('Costos de hospedaje en competencias');
    expect(row.color).toBe('#10b981');
    expect(row.is_active).toBe(true);
  });

  it('returns an error if the name is missing', async () => {
    const fd = new FormData();
    // no 'name' field

    const result = await createExpenseCategory(fd);

    expect(result.error).not.toBeNull();
    expect(result.id).toBeUndefined();
  });

  it('returns an error if name exceeds 100 characters', async () => {
    const fd = new FormData();
    fd.set('name', 'X'.repeat(101));

    const result = await createExpenseCategory(fd);

    expect(result.error).not.toBeNull();
  });

  it('is blocked when user lacks manage_finances', async () => {
    vi.mocked(assertPermission).mockResolvedValueOnce({ error: 'Forbidden.' });

    const fd = new FormData();
    fd.set('name', 'Equipamiento');

    const result = await createExpenseCategory(fd);

    expect(result.error).toMatch(/Forbidden/);
    expect(db.finance_expense_categories).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. BUDGETS — LIFECYCLE
// ─────────────────────────────────────────────────────────────────────────────

describe('2. Budgets — create, update, cancel, delete', () => {
  it('creates a budget and returns { error: null, id }', async () => {
    const result = await createBudget(makeBudgetFd());

    expect(result.error).toBeNull();
    expect(result.id).toBeDefined();
    expect(db.finance_budgets).toHaveLength(1);
  });

  it('persists budget with correct fields and creator', async () => {
    await createBudget(makeBudgetFd({ name: 'Presupuesto Obregonense 2026' }));

    const row = db.finance_budgets[0];
    expect(row.name).toBe('Presupuesto Obregonense 2026');
    expect(row.fiscal_year).toBe(2025);
    expect(row.total_amount).toBe(1000000);
    expect(row.created_by).toBe(IDS.admin);
  });

  it('updates a budget name', async () => {
    db.finance_budgets.push({
      id: IDS.budget,
      name: 'Viejo nombre',
      fiscal_year: 2025,
      total_amount: 1000000,
      start_date: '2025-01-01',
      end_date: '2025-12-31',
      status: 'active',
    });

    const fd = makeBudgetFd({ name: 'Presupuesto Modificado 2025' });
    const result = await updateBudget(IDS.budget, fd);

    expect(result.error).toBeNull();
    expect(db.finance_budgets[0].name).toBe('Presupuesto Modificado 2025');
  });

  it('cancels a budget (status → cancelled)', async () => {
    db.finance_budgets.push({ id: IDS.budget, name: 'B2025', status: 'active' });

    const result = await cancelBudget(IDS.budget);

    expect(result.error).toBeNull();
    expect(db.finance_budgets[0].status).toBe('cancelled');
  });

  it('deletes a cancelled budget permanently', async () => {
    db.finance_budgets.push({ id: IDS.budget, name: 'B2025', status: 'cancelled' });

    const result = await deleteBudget(IDS.budget);

    expect(result.error).toBeNull();
    expect(db.finance_budgets).toHaveLength(0);
  });

  it('rejects deletion of a non-cancelled budget', async () => {
    db.finance_budgets.push({ id: IDS.budget, name: 'B2025', status: 'active' });

    const result = await deleteBudget(IDS.budget);

    expect(result.error).not.toBeNull();
    expect(result.error).toMatch(/Cancelado/);
    expect(db.finance_budgets).toHaveLength(1);
  });

  it('rejects create with invalid fiscal year', async () => {
    const result = await createBudget(makeBudgetFd({ fiscal_year: '1800' }));
    expect(result.error).not.toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. BUDGET ITEMS — CRUD
// ─────────────────────────────────────────────────────────────────────────────

describe('3. Budget items — create, update, delete', () => {
  beforeEach(() => {
    db.finance_budgets.push({ id: IDS.budget, name: 'B2025', status: 'active' });
  });

  function makeItemFd(overrides: Record<string, string> = {}): FormData {
    const fd = new FormData();
    fd.set('budget_id',   overrides.budget_id   ?? IDS.budget);
    fd.set('name',        overrides.name        ?? 'Partida Transporte');
    fd.set('amount',      overrides.amount      ?? '200000');
    fd.set('description', overrides.description ?? '');  // avoid null
    return fd;
  }

  it('creates a budget item and returns { error: null, id }', async () => {
    const result = await createBudgetItem(makeItemFd());

    expect(result.error).toBeNull();
    expect(result.id).toBeDefined();
    expect(db.finance_budget_items).toHaveLength(1);
  });

  it('budget item is linked to the correct budget', async () => {
    await createBudgetItem(makeItemFd());

    expect(db.finance_budget_items[0].budget_id).toBe(IDS.budget);
    expect(db.finance_budget_items[0].amount).toBe(200000);
  });

  it('updates a budget item amount', async () => {
    db.finance_budget_items.push({
      id: IDS.budgetItem, budget_id: IDS.budget, name: 'Partida', amount: 100000,
    });

    const fd = makeItemFd({ name: 'Partida actualizada', amount: '250000' });
    fd.set('budget_id', IDS.budget);
    const result = await updateBudgetItem(IDS.budgetItem, fd);

    expect(result.error).toBeNull();
    expect(db.finance_budget_items[0].amount).toBe(250000);
    expect(db.finance_budget_items[0].name).toBe('Partida actualizada');
  });

  it('deletes a budget item', async () => {
    db.finance_budget_items.push({
      id: IDS.budgetItem, budget_id: IDS.budget, name: 'Partida', amount: 50000,
    });

    const result = await deleteBudgetItem(IDS.budgetItem, IDS.budget);

    expect(result.error).toBeNull();
    expect(db.finance_budget_items).toHaveLength(0);
  });

  it('rejects item creation with missing required fields', async () => {
    const fd = new FormData();
    // Missing name and amount
    fd.set('budget_id', IDS.budget);

    const result = await createBudgetItem(fd);
    expect(result.error).not.toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. EXPENSES — CRUD
// ─────────────────────────────────────────────────────────────────────────────

describe('4. Expenses — create and edit', () => {
  it('creates an expense in draft status', async () => {
    const result = await createExpense(makeExpenseFd());

    expect(result.error).toBeNull();
    expect(result.id).toBeDefined();
    expect(db.finance_expenses).toHaveLength(1);
    expect(db.finance_expenses[0].status).toBe('draft');
  });

  it('persists expense fields correctly', async () => {
    await createExpense(makeExpenseFd({
      title: 'Karategi equipo nacional',
      amount: '12500',
      disciplina: 'KARATE',
      description: 'Uniformes oficiales para competencia nacional',
    }));

    const row = db.finance_expenses[0];
    expect(row.title).toBe('Karategi equipo nacional');
    expect(row.amount).toBe(12500);
    expect(row.disciplina).toBe('KARATE');
    expect(row.description).toBe('Uniformes oficiales para competencia nacional');
    expect(row.created_by).toBe(IDS.admin);
  });

  it('allows full edit of a draft expense (all financial fields)', async () => {
    seedExpense('draft');

    const fd = makeExpenseFd({ title: 'Título editado', amount: '8000' });
    const result = await updateExpense(IDS.expense, fd);

    expect(result.error).toBeNull();
    const row = db.finance_expenses[0];
    expect(row.title).toBe('Título editado');
    expect(row.amount).toBe(8000);
    // Editing a draft resets to draft
    expect(row.status).toBe('draft');
  });

  it('allows full edit of a rejected expense', async () => {
    seedExpense('rejected');

    const fd = makeExpenseFd({ title: 'Corregido tras rechazo', amount: '4500' });
    const result = await updateExpense(IDS.expense, fd);

    expect(result.error).toBeNull();
    expect(db.finance_expenses[0].title).toBe('Corregido tras rechazo');
    expect(db.finance_expenses[0].status).toBe('draft');
  });

  it('allows only partial edit of a submitted expense (title, notes, invoice only)', async () => {
    seedExpense('submitted');

    const fd = new FormData();
    fd.set('title', 'Título parcialmente editado');
    fd.set('invoice_number', 'FAC-9999');
    fd.set('description', 'Descripción actualizada');
    fd.set('notes', 'Nota interna nueva');
    const result = await updateExpense(IDS.expense, fd);

    expect(result.error).toBeNull();
    const row = db.finance_expenses[0];
    expect(row.title).toBe('Título parcialmente editado');
    expect(row.invoice_number).toBe('FAC-9999');
    // Amount should NOT have changed (partial edit ignores financial fields)
    expect(row.amount).toBe(5000);
    expect(row.status).toBe('submitted'); // status stays submitted
  });

  it('allows partial edit of an approved expense', async () => {
    seedExpense('approved');

    const fd = new FormData();
    fd.set('title', 'Gasto aprobado — folio corregido');
    fd.set('invoice_number', 'FAC-CORR-01');
    const result = await updateExpense(IDS.expense, fd);

    expect(result.error).toBeNull();
    expect(db.finance_expenses[0].title).toBe('Gasto aprobado — folio corregido');
    expect(db.finance_expenses[0].status).toBe('approved'); // unchanged
  });

  it('rejects create with missing required fields', async () => {
    const fd = new FormData();
    fd.set('category_id', IDS.category);
    // missing title, amount, expense_date

    const result = await createExpense(fd);
    expect(result.error).not.toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. EXPENSE DELETE
// ─────────────────────────────────────────────────────────────────────────────

describe('5. Expense delete — state constraints', () => {
  it('deletes a draft expense successfully', async () => {
    seedExpense('draft');

    const result = await deleteExpense(IDS.expense);

    expect(result.error).toBeNull();
    expect(db.finance_expenses).toHaveLength(0);
  });

  it('deletes a cancelled expense successfully', async () => {
    seedExpense('cancelled');

    const result = await deleteExpense(IDS.expense);

    expect(result.error).toBeNull();
    expect(db.finance_expenses).toHaveLength(0);
  });

  it('blocks deletion of a submitted expense', async () => {
    seedExpense('submitted');

    const result = await deleteExpense(IDS.expense);

    expect(result.error).not.toBeNull();
    expect(result.error).toMatch(/Borrador|Cancelado/);
    expect(db.finance_expenses).toHaveLength(1);
  });

  it('blocks deletion of an approved expense', async () => {
    seedExpense('approved');

    const result = await deleteExpense(IDS.expense);

    expect(result.error).not.toBeNull();
    expect(db.finance_expenses).toHaveLength(1);
  });

  it('blocks deletion of a paid expense', async () => {
    seedExpense('paid');

    const result = await deleteExpense(IDS.expense);

    expect(result.error).not.toBeNull();
    expect(db.finance_expenses).toHaveLength(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. APPROVAL WORKFLOW — HAPPY PATH
// ─────────────────────────────────────────────────────────────────────────────

describe('6. Approval workflow — full happy path: draft → submitted → approved → paid', () => {
  beforeEach(() => {
    seedExpense('draft');
  });

  it('step 1 — submitExpense moves status to submitted', async () => {
    const result = await submitExpense(IDS.expense);

    expect(result.error).toBeNull();
    expect(db.finance_expenses[0].status).toBe('submitted');
  });

  it('step 1 — submitExpense creates an approval record with action=submitted', async () => {
    await submitExpense(IDS.expense);

    expect(db.finance_approvals).toHaveLength(1);
    const approval = db.finance_approvals[0];
    expect(approval.expense_id).toBe(IDS.expense);
    expect(approval.action).toBe('submitted');
    expect(approval.performed_by).toBe(IDS.admin);
  });

  it('step 2 — processApproval(approved) moves status to approved', async () => {
    db.finance_expenses[0].status = 'submitted';

    const result = await processApproval({ expense_id: IDS.expense, action: 'approved' });

    expect(result.error).toBeNull();
    expect(db.finance_expenses[0].status).toBe('approved');
  });

  it('step 2 — approval record has action=approved and correct performer', async () => {
    db.finance_expenses[0].status = 'submitted';

    await processApproval({ expense_id: IDS.expense, action: 'approved', notes: 'OK' });

    const approval = db.finance_approvals.find((a) => a.action === 'approved');
    expect(approval).toBeDefined();
    expect(approval!.notes).toBe('OK');
    expect(approval!.performed_by).toBe(IDS.admin);
  });

  it('step 3 — processApproval(paid) moves status to paid', async () => {
    db.finance_expenses[0].status = 'approved';

    const result = await processApproval({ expense_id: IDS.expense, action: 'paid' });

    expect(result.error).toBeNull();
    expect(db.finance_expenses[0].status).toBe('paid');
  });

  it('complete flow: draft → submitted → approved → paid in sequence', async () => {
    // Submit
    await submitExpense(IDS.expense);
    expect(db.finance_expenses[0].status).toBe('submitted');

    // Approve
    await processApproval({ expense_id: IDS.expense, action: 'approved' });
    expect(db.finance_expenses[0].status).toBe('approved');

    // Pay
    await processApproval({ expense_id: IDS.expense, action: 'paid' });
    expect(db.finance_expenses[0].status).toBe('paid');

    // Approval records created for each transition
    expect(db.finance_approvals.length).toBeGreaterThanOrEqual(3);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. APPROVAL WORKFLOW — REJECTION PATHS
// ─────────────────────────────────────────────────────────────────────────────

describe('7. Approval workflow — rejection paths', () => {
  it('rejects a submitted expense (submitted → rejected)', async () => {
    seedExpense('submitted');

    const result = await processApproval({
      expense_id: IDS.expense,
      action: 'rejected',
      notes: 'Falta documentación de soporte',
    });

    expect(result.error).toBeNull();
    expect(db.finance_expenses[0].status).toBe('rejected');

    const approval = db.finance_approvals.find((a) => a.action === 'rejected');
    expect(approval!.notes).toBe('Falta documentación de soporte');
  });

  it('rejects an approved expense (approved → rejected)', async () => {
    seedExpense('approved');

    const result = await processApproval({ expense_id: IDS.expense, action: 'rejected' });

    expect(result.error).toBeNull();
    expect(db.finance_expenses[0].status).toBe('rejected');
  });

  it('a rejected expense can be re-edited and re-submitted', async () => {
    seedExpense('rejected');

    // Re-edit (full edit allowed on rejected)
    const editResult = await updateExpense(IDS.expense, makeExpenseFd({ title: 'Corrección del gasto' }));
    expect(editResult.error).toBeNull();
    expect(db.finance_expenses[0].status).toBe('draft');

    // Re-submit
    const submitResult = await submitExpense(IDS.expense);
    expect(submitResult.error).toBeNull();
    expect(db.finance_expenses[0].status).toBe('submitted');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. APPROVAL WORKFLOW — CANCEL
// ─────────────────────────────────────────────────────────────────────────────

describe('8. Approval workflow — cancel from eligible states', () => {
  it.each(['draft', 'submitted', 'approved', 'rejected'] as const)(
    'cancels a "%s" expense successfully',
    async (status) => {
      seedExpense(status);

      const result = await processApproval({ expense_id: IDS.expense, action: 'cancelled' });

      expect(result.error).toBeNull();
      expect(db.finance_expenses[0].status).toBe('cancelled');
    }
  );

  it('records a cancellation approval entry with the canceller', async () => {
    seedExpense('submitted');

    await processApproval({
      expense_id: IDS.expense,
      action: 'cancelled',
      notes: 'Presupuesto recortado',
    });

    const approval = db.finance_approvals.find((a) => a.action === 'cancelled');
    expect(approval).toBeDefined();
    expect(approval!.performed_by).toBe(IDS.admin);
    expect(approval!.notes).toBe('Presupuesto recortado');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 9. APPROVAL WORKFLOW — INVALID TRANSITIONS
// ─────────────────────────────────────────────────────────────────────────────

describe('9. Approval workflow — invalid transitions are rejected', () => {
  it('cannot approve a draft expense (must be submitted first)', async () => {
    seedExpense('draft');

    const result = await processApproval({ expense_id: IDS.expense, action: 'approved' });

    expect(result.error).not.toBeNull();
    expect(result.error).toMatch(/No se puede cambiar/);
    expect(db.finance_expenses[0].status).toBe('draft');
  });

  it('cannot pay a submitted expense (must be approved first)', async () => {
    seedExpense('submitted');

    const result = await processApproval({ expense_id: IDS.expense, action: 'paid' });

    expect(result.error).not.toBeNull();
    expect(db.finance_expenses[0].status).toBe('submitted');
  });

  it('cannot approve an already-approved expense', async () => {
    seedExpense('approved');

    const result = await processApproval({ expense_id: IDS.expense, action: 'approved' });

    expect(result.error).not.toBeNull();
    expect(db.finance_expenses[0].status).toBe('approved');
  });

  it('cannot do any action on a paid expense', async () => {
    seedExpense('paid');

    const cancelResult = await processApproval({ expense_id: IDS.expense, action: 'cancelled' });
    expect(cancelResult.error).not.toBeNull();
    expect(db.finance_expenses[0].status).toBe('paid');
  });

  it('cannot submit an already-submitted expense', async () => {
    seedExpense('submitted');

    const result = await submitExpense(IDS.expense);

    expect(result.error).not.toBeNull();
    expect(result.error).toMatch(/Borrador/);
    expect(db.finance_expenses[0].status).toBe('submitted');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 10. SUPPLIERS — CRUD
// ─────────────────────────────────────────────────────────────────────────────

describe('10. Suppliers — create, update, deactivate, delete', () => {
  it('creates a supplier and returns { error: null, id }', async () => {
    const result = await createSupplier(makeSupplierFd());

    expect(result.error).toBeNull();
    expect(result.id).toBeDefined();
    expect(db.finance_suppliers).toHaveLength(1);
  });

  it('persists supplier fields correctly', async () => {
    await createSupplier(makeSupplierFd({
      name: 'MexiSport SA de CV',
      rfc:  'MES210101XYZ',
      email: 'ventas@mexisport.com',
    }));

    const row = db.finance_suppliers[0];
    expect(row.name).toBe('MexiSport SA de CV');
    expect(row.email).toBe('ventas@mexisport.com');
    expect(row.created_by).toBe(IDS.admin);
  });

  it('updates a supplier', async () => {
    db.finance_suppliers.push({ id: IDS.supplier, name: 'Viejo nombre', is_active: true });

    const fd = makeSupplierFd({ name: 'Deportes Olímpicos SA — Actualizado' });
    const result = await updateSupplier(IDS.supplier, fd);

    expect(result.error).toBeNull();
    expect(db.finance_suppliers[0].name).toBe('Deportes Olímpicos SA — Actualizado');
  });

  it('deactivates a supplier (is_active → false)', async () => {
    db.finance_suppliers.push({ id: IDS.supplier, name: 'Proveedor', is_active: true });

    const result = await deactivateSupplier(IDS.supplier);

    expect(result.error).toBeNull();
    expect(db.finance_suppliers[0].is_active).toBe(false);
  });

  it('permanently deletes a supplier', async () => {
    db.finance_suppliers.push({ id: IDS.supplier, name: 'Proveedor', is_active: true });

    // Need to mock supplier_attachments query too
    vi.mocked(supabaseAdmin.from).mockImplementation((table: string) => {
      if (table === 'finance_supplier_attachments') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: [] }),
          }),
        } as unknown as ReturnType<typeof supabaseAdmin.from>;
      }
      return makeTableProxy(table) as unknown as ReturnType<typeof supabaseAdmin.from>;
    });

    const result = await deleteSupplier(IDS.supplier);

    expect(result.error).toBeNull();
    expect(db.finance_suppliers).toHaveLength(0);
  });

  it('rejects creation with missing name', async () => {
    const fd = new FormData(); // no name
    const result = await createSupplier(fd);
    expect(result.error).not.toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 11. PAYMENTS — CRUD
// ─────────────────────────────────────────────────────────────────────────────

describe('11. Payments — create, update, delete', () => {
  it('creates a payment and returns { error: null, id }', async () => {
    const result = await createPayment(makePaymentFd());

    expect(result.error).toBeNull();
    expect(result.id).toBeDefined();
    expect(db.finance_payments).toHaveLength(1);
  });

  it('persists payment fields correctly', async () => {
    await createPayment(makePaymentFd({
      amount:         '12500',
      payment_method: 'check',
      reference:      'CHQ-001',
    }));

    const row = db.finance_payments[0];
    expect(row.expense_id).toBe(IDS.expense);
    expect(row.amount).toBe(12500);
    expect(row.payment_method).toBe('check');
    expect(row.reference).toBe('CHQ-001');
    expect(row.created_by).toBe(IDS.admin);
  });

  it('updates a payment amount and method', async () => {
    db.finance_payments.push({
      id: IDS.payment,
      expense_id:     IDS.expense,
      amount:         5000,
      payment_date:   '2025-03-20',
      payment_method: 'transfer',
    });

    const fd = new FormData();
    fd.set('expense_id',     IDS.expense);
    fd.set('amount',         '5500');
    fd.set('payment_date',   '2025-03-21');
    fd.set('payment_method', 'cash');
    const result = await updatePayment(IDS.payment, fd);

    expect(result.error).toBeNull();
    expect(db.finance_payments[0].amount).toBe(5500);
    expect(db.finance_payments[0].payment_method).toBe('cash');
  });

  it('deletes a payment', async () => {
    db.finance_payments.push({
      id: IDS.payment, expense_id: IDS.expense, amount: 5000,
      payment_date: '2025-03-20', payment_method: 'transfer',
    });

    const result = await deletePayment(IDS.payment);

    expect(result.error).toBeNull();
    expect(db.finance_payments).toHaveLength(0);
  });

  it('rejects create with missing required fields', async () => {
    const fd = new FormData();
    fd.set('expense_id', IDS.expense);
    // missing amount, payment_date, payment_method

    const result = await createPayment(fd);
    expect(result.error).not.toBeNull();
  });

  it('creates payments for different methods', async () => {
    const methods = ['transfer', 'check', 'cash', 'card', 'other'] as const;
    for (const method of methods) {
      db.finance_payments = [];
      const result = await createPayment(makePaymentFd({ payment_method: method }));
      expect(result.error).toBeNull();
      expect(db.finance_payments[0].payment_method).toBe(method);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 12. PERMISSION GUARDS
// ─────────────────────────────────────────────────────────────────────────────

describe('12. Permission guards — manage_finances vs approve_finances', () => {
  it('createExpense is blocked without manage_finances', async () => {
    vi.mocked(assertPermission).mockResolvedValueOnce({ error: 'Forbidden.' });

    const result = await createExpense(makeExpenseFd());

    expect(result.error).toMatch(/Forbidden/);
    expect(db.finance_expenses).toHaveLength(0);
  });

  it('submitExpense is blocked without manage_finances', async () => {
    seedExpense('draft');
    vi.mocked(assertPermission).mockResolvedValueOnce({ error: 'Forbidden.' });

    const result = await submitExpense(IDS.expense);

    expect(result.error).toMatch(/Forbidden/);
    expect(db.finance_expenses[0].status).toBe('draft');
  });

  it('processApproval is blocked without approve_finances', async () => {
    seedExpense('submitted');
    vi.mocked(assertPermission).mockResolvedValueOnce({ error: 'Forbidden.' });

    const result = await processApproval({ expense_id: IDS.expense, action: 'approved' });

    expect(result.error).toMatch(/Forbidden/);
    expect(db.finance_expenses[0].status).toBe('submitted');
  });

  it('deleteExpense is blocked without manage_finances', async () => {
    seedExpense('draft');
    vi.mocked(assertPermission).mockResolvedValueOnce({ error: 'Forbidden.' });

    const result = await deleteExpense(IDS.expense);

    expect(result.error).toMatch(/Forbidden/);
    expect(db.finance_expenses).toHaveLength(1);
  });

  it('createBudget is blocked without manage_finances', async () => {
    vi.mocked(assertPermission).mockResolvedValueOnce({ error: 'Forbidden.' });

    const result = await createBudget(makeBudgetFd());

    expect(result.error).toMatch(/Forbidden/);
    expect(db.finance_budgets).toHaveLength(0);
  });

  it('createSupplier is blocked without manage_finances', async () => {
    vi.mocked(assertPermission).mockResolvedValueOnce({ error: 'Forbidden.' });

    const result = await createSupplier(makeSupplierFd());

    expect(result.error).toMatch(/Forbidden/);
    expect(db.finance_suppliers).toHaveLength(0);
  });

  it('createPayment is blocked without manage_finances', async () => {
    vi.mocked(assertPermission).mockResolvedValueOnce({ error: 'Forbidden.' });

    const result = await createPayment(makePaymentFd());

    expect(result.error).toMatch(/Forbidden/);
    expect(db.finance_payments).toHaveLength(0);
  });

  it('no DB mutations occur when blocked', async () => {
    vi.mocked(assertPermission).mockResolvedValue({ error: 'Forbidden.' });

    await createExpense(makeExpenseFd());
    await createBudget(makeBudgetFd());
    await createSupplier(makeSupplierFd());

    expect(db.finance_expenses).toHaveLength(0);
    expect(db.finance_budgets).toHaveLength(0);
    expect(db.finance_suppliers).toHaveLength(0);
  });
});
