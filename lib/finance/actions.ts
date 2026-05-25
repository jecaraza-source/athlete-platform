'use server';

import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { assertPermission, getCurrentUser } from '@/lib/rbac/server';
import {
  budgetSchema,
  budgetItemSchema,
  expenseSchema,
  supplierSchema,
  paymentSchema,
  approvalSchema,
  FINANCE_ALLOWED_MIME_TYPES,
  FINANCE_MAX_FILE_SIZE_BYTES,
  type FinanceBudget,
  type FinanceBudgetItem,
  type FinanceExpense,
  type FinanceExpenseCategory,
  type FinanceSupplier,
  type FinancePayment,
  type FinanceAttachment,
  type FinanceApproval,
  type FinanceSummary,
  type ExpenseStatus,
} from '@/lib/types/finance';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

type ActionResult = { error: string | null };
type ActionResultWithId = ActionResult & { id?: string };

const FINANCE_PATH = '/finances';

async function logActivity(
  entityType: string,
  entityId: string,
  action: string,
  performedBy: string | null,
  metadata?: Record<string, unknown>
): Promise<void> {
  await supabaseAdmin.from('finance_activity_log').insert({
    entity_type:  entityType,
    entity_id:    entityId,
    action,
    performed_by: performedBy,
    metadata:     metadata ?? null,
  });
}

function revalidateFinancePaths(extra?: string[]) {
  revalidatePath(FINANCE_PATH);
  revalidatePath(`${FINANCE_PATH}/budgets`);
  revalidatePath(`${FINANCE_PATH}/expenses`);
  revalidatePath(`${FINANCE_PATH}/payments`);
  revalidatePath(`${FINANCE_PATH}/suppliers`);
  revalidatePath(`${FINANCE_PATH}/reports`);
  extra?.forEach((p) => revalidatePath(p));
}

// ---------------------------------------------------------------------------
// Expense Categories
// ---------------------------------------------------------------------------

export async function getExpenseCategories(): Promise<FinanceExpenseCategory[]> {
  const denied = await assertPermission('view_finances');
  if (denied) return [];

  const { data } = await supabaseAdmin
    .from('finance_expense_categories')
    .select('*')
    .eq('is_active', true)
    .order('name');

  return (data ?? []) as FinanceExpenseCategory[];
}

/**
 * Crea un nuevo tipo de gasto (categoría).
 * Requiere: manage_finances.
 */
export async function createExpenseCategory(
  formData: FormData
): Promise<{ error: string | null; id?: string }> {
  const denied = await assertPermission('manage_finances');
  if (denied) return denied;

  const name = (formData.get('name') as string)?.trim();
  const description = (formData.get('description') as string)?.trim() || null;
  const color = (formData.get('color') as string)?.trim() || null;

  if (!name) return { error: 'El nombre es requerido.' };
  if (name.length > 100) return { error: 'El nombre no puede superar 100 caracteres.' };

  const { data, error } = await supabaseAdmin
    .from('finance_expense_categories')
    .insert({ name, description, color, is_active: true })
    .select('id')
    .single();

  if (error) {
    // Unique constraint
    if (error.code === '23505') return { error: `Ya existe una categoría llamada "${name}".` };
    return { error: error.message };
  }

  revalidateFinancePaths();
  return { error: null, id: data.id };
}

// ---------------------------------------------------------------------------
// Budgets
// ---------------------------------------------------------------------------

export async function listBudgets(): Promise<FinanceBudget[]> {
  const denied = await assertPermission('view_finances');
  if (denied) return [];

  const { data } = await supabaseAdmin
    .from('finance_budgets')
    .select('*')
    .order('fiscal_year', { ascending: false })
    .order('created_at', { ascending: false });

  return (data ?? []) as FinanceBudget[];
}

export async function getBudget(id: string): Promise<FinanceBudget | null> {
  const denied = await assertPermission('view_finances');
  if (denied) return null;

  const { data } = await supabaseAdmin
    .from('finance_budgets')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  return (data ?? null) as FinanceBudget | null;
}

export async function getBudgetItems(budgetId: string): Promise<FinanceBudgetItem[]> {
  const denied = await assertPermission('view_finances');
  if (denied) return [];

  const { data } = await supabaseAdmin
    .from('finance_budget_items')
    .select('*, category:finance_expense_categories(id, name, color, description, is_active, created_at)')
    .eq('budget_id', budgetId)
    .order('name');

  return (data ?? []) as unknown as FinanceBudgetItem[];
}

export async function createBudget(formData: FormData): Promise<ActionResultWithId> {
  const denied = await assertPermission('manage_finances');
  if (denied) return denied;

  const user = await getCurrentUser();
  if (!user?.profile) return { error: 'Perfil no encontrado.' };

  const raw = {
    name:         formData.get('name'),
    description:  formData.get('description'),
    fiscal_year:  formData.get('fiscal_year'),
    start_date:   formData.get('start_date'),
    end_date:     formData.get('end_date'),
    total_amount: formData.get('total_amount'),
    status:       formData.get('status') || 'active',
    notes:        formData.get('notes'),
  };

  const parsed = budgetSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const { data, error } = await supabaseAdmin
    .from('finance_budgets')
    .insert({ ...parsed.data, created_by: user.profile.id })
    .select('id')
    .single();

  if (error) return { error: error.message };

  await logActivity('budget', data.id, 'created', user.profile.id, { name: parsed.data.name });
  revalidateFinancePaths();
  return { error: null, id: data.id };
}

export async function updateBudget(
  id: string,
  formData: FormData
): Promise<ActionResult> {
  const denied = await assertPermission('manage_finances');
  if (denied) return denied;

  const user = await getCurrentUser();

  const raw = {
    name:         formData.get('name'),
    description:  formData.get('description'),
    fiscal_year:  formData.get('fiscal_year'),
    start_date:   formData.get('start_date'),
    end_date:     formData.get('end_date'),
    total_amount: formData.get('total_amount'),
    status:       formData.get('status') || 'active',
    notes:        formData.get('notes'),
  };

  const parsed = budgetSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { error } = await supabaseAdmin
    .from('finance_budgets')
    .update(parsed.data)
    .eq('id', id);

  if (error) return { error: error.message };

  await logActivity('budget', id, 'updated', user?.profile?.id ?? null);
  revalidateFinancePaths([`${FINANCE_PATH}/budgets/${id}`]);
  return { error: null };
}

export async function createBudgetItem(formData: FormData): Promise<ActionResultWithId> {
  const denied = await assertPermission('manage_finances');
  if (denied) return denied;

  const user = await getCurrentUser();

  const raw = {
    budget_id:   formData.get('budget_id'),
    category_id: formData.get('category_id') || undefined,
    name:        formData.get('name'),
    description: formData.get('description'),
    amount:      formData.get('amount'),
  };

  const parsed = budgetItemSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { data, error } = await supabaseAdmin
    .from('finance_budget_items')
    .insert(parsed.data)
    .select('id')
    .single();

  if (error) return { error: error.message };

  await logActivity('budget', parsed.data.budget_id, 'item_created', user?.profile?.id ?? null, {
    item_id: data.id,
    name: parsed.data.name,
  });
  revalidateFinancePaths([`${FINANCE_PATH}/budgets/${parsed.data.budget_id}`]);
  return { error: null, id: data.id };
}

// ---------------------------------------------------------------------------
// Expenses
// ---------------------------------------------------------------------------

export async function listExpenses(filters?: {
  status?: ExpenseStatus;
  category_id?: string;
  athlete_id?: string;
  budget_item_id?: string;
}): Promise<FinanceExpense[]> {
  const denied = await assertPermission('view_finances');
  if (denied) return [];

  let query = supabaseAdmin
    .from('finance_expenses')
    .select(`
      *,
      category:finance_expense_categories(id, name, color, description, is_active, created_at),
      supplier:finance_suppliers(id, name),
      creator:profiles!created_by(id, first_name, last_name)
    `)
    .order('expense_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (filters?.status)         query = query.eq('status', filters.status);
  if (filters?.category_id)    query = query.eq('category_id', filters.category_id);
  if (filters?.athlete_id)     query = query.eq('athlete_id', filters.athlete_id);
  if (filters?.budget_item_id) query = query.eq('budget_item_id', filters.budget_item_id);

  const { data } = await query;
  return (data ?? []) as unknown as FinanceExpense[];
}

export async function getExpense(id: string): Promise<FinanceExpense | null> {
  const denied = await assertPermission('view_finances');
  if (denied) return null;

  const { data } = await supabaseAdmin
    .from('finance_expenses')
    .select(`
      *,
      category:finance_expense_categories(id, name, color, description, is_active, created_at),
      supplier:finance_suppliers(id, name),
      creator:profiles!created_by(id, first_name, last_name)
    `)
    .eq('id', id)
    .maybeSingle();

  return (data ?? null) as unknown as FinanceExpense | null;
}

export async function createExpense(formData: FormData): Promise<ActionResultWithId> {
  const denied = await assertPermission('manage_finances');
  if (denied) return denied;

  const user = await getCurrentUser();
  if (!user?.profile) return { error: 'Perfil no encontrado.' };

  const raw = {
    budget_item_id: formData.get('budget_item_id') || undefined,
    category_id:    formData.get('category_id'),
    supplier_id:    formData.get('supplier_id') || undefined,
    athlete_id:     formData.get('athlete_id') || undefined,
    disciplina:     formData.get('disciplina') || undefined,
    title:          formData.get('title'),
    description:    formData.get('description'),
    amount:         formData.get('amount'),
    expense_date:   formData.get('expense_date'),
    invoice_number: formData.get('invoice_number') || undefined,
    notes:          formData.get('notes'),
  };

  const parsed = expenseSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { data, error } = await supabaseAdmin
    .from('finance_expenses')
    .insert({ ...parsed.data, created_by: user.profile.id, status: 'draft' })
    .select('id')
    .single();

  if (error) return { error: error.message };

  await logActivity('expense', data.id, 'created', user.profile.id, {
    title: parsed.data.title,
    amount: parsed.data.amount,
  });
  revalidateFinancePaths([`${FINANCE_PATH}/expenses/${data.id}`]);
  return { error: null, id: data.id };
}

export async function updateExpense(
  id: string,
  formData: FormData
): Promise<ActionResult> {
  const denied = await assertPermission('manage_finances');
  if (denied) return denied;

  const user = await getCurrentUser();

  const { data: existing } = await supabaseAdmin
    .from('finance_expenses')
    .select('status')
    .eq('id', id)
    .maybeSingle();

  if (!existing) return { error: 'Gasto no encontrado.' };

  const isFullEdit = ['draft', 'rejected'].includes(existing.status);

  if (isFullEdit) {
    // Edición completa: todos los campos financieros
    const raw = {
      budget_item_id: formData.get('budget_item_id') || undefined,
      category_id:    formData.get('category_id'),
      supplier_id:    formData.get('supplier_id') || undefined,
      athlete_id:     formData.get('athlete_id') || undefined,
      disciplina:     formData.get('disciplina') || undefined,
      title:          formData.get('title'),
      description:    formData.get('description'),
      amount:         formData.get('amount'),
      expense_date:   formData.get('expense_date'),
      invoice_number: formData.get('invoice_number') || undefined,
      notes:          formData.get('notes'),
    };
    const parsed = expenseSchema.safeParse(raw);
    if (!parsed.success) return { error: parsed.error.issues[0].message };

    const { error } = await supabaseAdmin
      .from('finance_expenses')
      .update({ ...parsed.data, status: 'draft' })
      .eq('id', id);
    if (error) return { error: error.message };
  } else {
    // Edición parcial: solo campos no financieros (título, descripción, notas, folio)
    const title         = (formData.get('title') as string)?.trim();
    const description   = (formData.get('description') as string)?.trim() || null;
    const notes         = (formData.get('notes') as string)?.trim() || null;
    const invoice_number = (formData.get('invoice_number') as string)?.trim() || null;

    if (!title) return { error: 'El título es requerido.' };

    const { error } = await supabaseAdmin
      .from('finance_expenses')
      .update({ title, description, notes, invoice_number })
      .eq('id', id);
    if (error) return { error: error.message };
  }

  await logActivity('expense', id, 'updated', user?.profile?.id ?? null, { partial: !isFullEdit });
  revalidateFinancePaths([`${FINANCE_PATH}/expenses/${id}`]);
  return { error: null };
}

export async function submitExpense(id: string): Promise<ActionResult> {
  const denied = await assertPermission('manage_finances');
  if (denied) return denied;

  const user = await getCurrentUser();
  if (!user?.profile) return { error: 'Perfil no encontrado.' };

  const { data: expense } = await supabaseAdmin
    .from('finance_expenses')
    .select('status')
    .eq('id', id)
    .maybeSingle();

  if (!expense) return { error: 'Gasto no encontrado.' };
  if (expense.status !== 'draft') {
    return { error: 'Solo los gastos en Borrador pueden enviarse a revisión.' };
  }

  const { error } = await supabaseAdmin
    .from('finance_expenses')
    .update({ status: 'submitted' })
    .eq('id', id);

  if (error) return { error: error.message };

  // Record approval event
  await supabaseAdmin.from('finance_approvals').insert({
    expense_id:   id,
    action:       'submitted',
    performed_by: user.profile.id,
  });

  await logActivity('expense', id, 'submitted', user.profile.id);
  revalidateFinancePaths([`${FINANCE_PATH}/expenses/${id}`]);
  return { error: null };
}

export async function processApproval(data: {
  expense_id: string;
  action: 'approved' | 'rejected' | 'paid' | 'cancelled';
  notes?: string;
}): Promise<ActionResult> {
  const denied = await assertPermission('approve_finances');
  if (denied) return denied;

  const user = await getCurrentUser();
  if (!user?.profile) return { error: 'Perfil no encontrado.' };

  const parsed = approvalSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { data: expense } = await supabaseAdmin
    .from('finance_expenses')
    .select('status')
    .eq('id', parsed.data.expense_id)
    .maybeSingle();

  if (!expense) return { error: 'Gasto no encontrado.' };

  // Validate transition
  const validTransitions: Record<string, string[]> = {
    approved:  ['submitted'],
    rejected:  ['submitted', 'approved'],
    paid:      ['approved'],
    cancelled: ['draft', 'submitted', 'approved', 'rejected'],
  };
  if (!validTransitions[parsed.data.action]?.includes(expense.status)) {
    return { error: `No se puede cambiar el estado de "${expense.status}" a "${parsed.data.action}".` };
  }

  const { error: updateError } = await supabaseAdmin
    .from('finance_expenses')
    .update({ status: parsed.data.action })
    .eq('id', parsed.data.expense_id);

  if (updateError) return { error: updateError.message };

  await supabaseAdmin.from('finance_approvals').insert({
    expense_id:   parsed.data.expense_id,
    action:       parsed.data.action,
    performed_by: user.profile.id,
    notes:        parsed.data.notes ?? null,
  });

  await logActivity('expense', parsed.data.expense_id, parsed.data.action, user.profile.id, {
    notes: parsed.data.notes,
  });

  revalidateFinancePaths([`${FINANCE_PATH}/expenses/${parsed.data.expense_id}`]);
  return { error: null };
}

export async function getExpenseApprovals(expenseId: string): Promise<FinanceApproval[]> {
  const denied = await assertPermission('view_finances');
  if (denied) return [];

  const { data } = await supabaseAdmin
    .from('finance_approvals')
    .select('*, performer:profiles!performed_by(id, first_name, last_name)')
    .eq('expense_id', expenseId)
    .order('created_at', { ascending: true });

  return (data ?? []) as unknown as FinanceApproval[];
}

// ---------------------------------------------------------------------------
// Suppliers
// ---------------------------------------------------------------------------

export async function listSuppliers(): Promise<FinanceSupplier[]> {
  const denied = await assertPermission('view_finances');
  if (denied) return [];

  const { data } = await supabaseAdmin
    .from('finance_suppliers')
    .select('*')
    .eq('is_active', true)
    .order('name');

  return (data ?? []) as FinanceSupplier[];
}

export async function createSupplier(formData: FormData): Promise<ActionResultWithId> {
  const denied = await assertPermission('manage_finances');
  if (denied) return denied;

  const user = await getCurrentUser();
  if (!user?.profile) return { error: 'Perfil no encontrado.' };

  const raw = {
    name:       formData.get('name'),
    rfc:        formData.get('rfc') || undefined,
    email:      formData.get('email') || undefined,
    phone:      formData.get('phone') || undefined,
    address:    formData.get('address') || undefined,
    disciplina: formData.get('disciplina') || undefined,
    notes:      formData.get('notes') || undefined,
  };

  const parsed = supplierSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { data, error } = await supabaseAdmin
    .from('finance_suppliers')
    .insert({ ...parsed.data, created_by: user.profile.id })
    .select('id')
    .single();

  if (error) return { error: error.message };

  await logActivity('supplier', data.id, 'created', user.profile.id, { name: parsed.data.name });
  revalidateFinancePaths();
  return { error: null, id: data.id };
}

export async function updateSupplier(
  id: string,
  formData: FormData
): Promise<ActionResult> {
  const denied = await assertPermission('manage_finances');
  if (denied) return denied;

  const user = await getCurrentUser();

  const raw = {
    name:       formData.get('name'),
    rfc:        formData.get('rfc') || undefined,
    email:      formData.get('email') || undefined,
    phone:      formData.get('phone') || undefined,
    address:    formData.get('address') || undefined,
    disciplina: formData.get('disciplina') || undefined,
    notes:      formData.get('notes') || undefined,
  };

  const parsed = supplierSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { error } = await supabaseAdmin
    .from('finance_suppliers')
    .update(parsed.data)
    .eq('id', id);

  if (error) return { error: error.message };

  await logActivity('supplier', id, 'updated', user?.profile?.id ?? null);
  revalidateFinancePaths();
  return { error: null };
}

export async function deactivateSupplier(id: string): Promise<ActionResult> {
  const denied = await assertPermission('manage_finances');
  if (denied) return denied;

  const user = await getCurrentUser();

  const { error } = await supabaseAdmin
    .from('finance_suppliers')
    .update({ is_active: false })
    .eq('id', id);

  if (error) return { error: error.message };

  await logActivity('supplier', id, 'deactivated', user?.profile?.id ?? null);
  revalidateFinancePaths();
  return { error: null };
}

/** Elimina un proveedor permanentemente junto con sus adjuntos en storage. */
export async function deleteSupplier(id: string): Promise<ActionResult> {
  const denied = await assertPermission('manage_finances');
  if (denied) return denied;

  const user = await getCurrentUser();

  // Eliminar adjuntos del proveedor en storage (best-effort)
  const { data: attachments } = await supabaseAdmin
    .from('finance_supplier_attachments')
    .select('file_path')
    .eq('supplier_id', id);

  if (attachments && attachments.length > 0) {
    await supabaseAdmin.storage
      .from('finance-files')
      .remove(attachments.map((a: { file_path: string }) => a.file_path));
  }

  const { data: supplier } = await supabaseAdmin
    .from('finance_suppliers')
    .select('name')
    .eq('id', id)
    .maybeSingle();

  const { error } = await supabaseAdmin
    .from('finance_suppliers')
    .delete()
    .eq('id', id);

  if (error) return { error: error.message };

  await logActivity('supplier', id, 'deleted', user?.profile?.id ?? null, { name: supplier?.name });
  revalidateFinancePaths();
  return { error: null };
}

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------

export async function listPayments(expenseId?: string): Promise<FinancePayment[]> {
  const denied = await assertPermission('view_finances');
  if (denied) return [];

  let query = supabaseAdmin
    .from('finance_payments')
    .select('*')
    .order('payment_date', { ascending: false });

  if (expenseId) query = query.eq('expense_id', expenseId);

  const { data } = await query;
  return (data ?? []) as FinancePayment[];
}

export async function updatePayment(
  id: string,
  formData: FormData
): Promise<ActionResult> {
  const denied = await assertPermission('manage_finances');
  if (denied) return denied;

  const user = await getCurrentUser();

  const raw = {
    expense_id:     formData.get('expense_id'),
    amount:         formData.get('amount'),
    payment_date:   formData.get('payment_date'),
    payment_method: formData.get('payment_method'),
    reference:      formData.get('reference') || undefined,
    notes:          formData.get('notes') || undefined,
  };

  const parsed = paymentSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { error } = await supabaseAdmin
    .from('finance_payments')
    .update({
      amount:         parsed.data.amount,
      payment_date:   parsed.data.payment_date,
      payment_method: parsed.data.payment_method,
      reference:      parsed.data.reference ?? null,
      notes:          parsed.data.notes ?? null,
    })
    .eq('id', id);

  if (error) return { error: error.message };

  await logActivity('payment', id, 'updated', user?.profile?.id ?? null);
  revalidateFinancePaths();
  return { error: null };
}

export async function deletePayment(id: string): Promise<ActionResult> {
  const denied = await assertPermission('manage_finances');
  if (denied) return denied;

  const user = await getCurrentUser();

  const { error } = await supabaseAdmin
    .from('finance_payments')
    .delete()
    .eq('id', id);

  if (error) return { error: error.message };

  await logActivity('payment', id, 'deleted', user?.profile?.id ?? null);
  revalidateFinancePaths();
  return { error: null };
}

export async function createPayment(formData: FormData): Promise<ActionResultWithId> {
  const denied = await assertPermission('manage_finances');
  if (denied) return denied;

  const user = await getCurrentUser();
  if (!user?.profile) return { error: 'Perfil no encontrado.' };

  const raw = {
    expense_id:     formData.get('expense_id'),
    amount:         formData.get('amount'),
    payment_date:   formData.get('payment_date'),
    payment_method: formData.get('payment_method'),
    reference:      formData.get('reference') || undefined,
    notes:          formData.get('notes') || undefined,
  };

  const parsed = paymentSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { data, error } = await supabaseAdmin
    .from('finance_payments')
    .insert({ ...parsed.data, created_by: user.profile.id })
    .select('id')
    .single();

  if (error) return { error: error.message };

  await logActivity('payment', data.id, 'created', user.profile.id, {
    expense_id: parsed.data.expense_id,
    amount: parsed.data.amount,
  });
  revalidateFinancePaths([`${FINANCE_PATH}/expenses/${parsed.data.expense_id}`]);
  return { error: null, id: data.id };
}

// ---------------------------------------------------------------------------
// Attachments
// ---------------------------------------------------------------------------

export async function listFinanceAttachments(expenseId: string): Promise<FinanceAttachment[]> {
  const denied = await assertPermission('view_finances');
  if (denied) return [];

  const { data } = await supabaseAdmin
    .from('finance_attachments')
    .select('*')
    .eq('expense_id', expenseId)
    .eq('is_active', true)
    .order('uploaded_at', { ascending: false });

  return (data ?? []) as FinanceAttachment[];
}

export async function uploadFinanceAttachment(
  expenseId: string,
  formData: FormData
): Promise<{ errors: string[]; uploaded: number }> {
  const denied = await assertPermission('manage_finances');
  if (denied) return { errors: [denied.error], uploaded: 0 };

  const user = await getCurrentUser();
  const uploaderProfileId = user?.profile?.id ?? null;
  const files = formData.getAll('files') as File[];

  if (!files.length || (files.length === 1 && files[0].size === 0)) {
    return { errors: ['No se seleccionaron archivos.'], uploaded: 0 };
  }

  // Validate
  const validationErrors: string[] = [];
  for (const file of files) {
    if (file.size > FINANCE_MAX_FILE_SIZE_BYTES) {
      validationErrors.push(`"${file.name}" excede 50 MB.`);
    }
    if (!FINANCE_ALLOWED_MIME_TYPES.has(file.type)) {
      validationErrors.push(`"${file.name}" tiene un tipo de archivo no permitido.`);
    }
  }
  if (validationErrors.length > 0) return { errors: validationErrors, uploaded: 0 };

  const uploadErrors: string[] = [];
  let uploaded = 0;

  for (const file of files) {
    const ext = file.name.split('.').pop() ?? 'bin';
    const storageName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const storagePath = `${expenseId}/${storageName}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error: uploadError } = await supabaseAdmin.storage
      .from('finance-files')
      .upload(storagePath, buffer, { contentType: file.type, upsert: false });

    if (uploadError) {
      uploadErrors.push(`"${file.name}": ${uploadError.message}`);
      continue;
    }

    const { error: dbError } = await supabaseAdmin.from('finance_attachments').insert({
      expense_id:         expenseId,
      file_name_original: file.name,
      file_name_storage:  storageName,
      file_path:          storagePath,
      mime_type:          file.type,
      file_extension:     ext,
      file_size:          file.size,
      uploaded_by:        uploaderProfileId,
    });

    if (dbError) {
      await supabaseAdmin.storage.from('finance-files').remove([storagePath]);
      uploadErrors.push(`"${file.name}": ${dbError.message}`);
      continue;
    }

    uploaded++;
  }

  if (uploaded > 0) {
    await logActivity('expense', expenseId, 'attachment_uploaded', uploaderProfileId, {
      count: uploaded,
    });
  }

  revalidatePath(`${FINANCE_PATH}/expenses/${expenseId}`);
  return { errors: uploadErrors, uploaded };
}

export async function getFinanceAttachmentSignedUrl(
  filePath: string
): Promise<string | null> {
  const denied = await assertPermission('view_finances');
  if (denied) return null;

  const { data } = await supabaseAdmin.storage
    .from('finance-files')
    .createSignedUrl(filePath, 60 * 60); // 1 hora

  return data?.signedUrl ?? null;
}

export async function deleteFinanceAttachment(
  attachmentId: string
): Promise<ActionResult> {
  const denied = await assertPermission('manage_finances');
  if (denied) return denied;

  const user = await getCurrentUser();

  const { data: row, error: fetchError } = await supabaseAdmin
    .from('finance_attachments')
    .select('expense_id, file_path')
    .eq('id', attachmentId)
    .single();

  if (fetchError || !row) return { error: 'Adjunto no encontrado.' };

  const { error } = await supabaseAdmin
    .from('finance_attachments')
    .update({
      is_active:  false,
      deleted_by: user?.profile?.id ?? null,
      deleted_at: new Date().toISOString(),
    })
    .eq('id', attachmentId);

  if (error) return { error: error.message };

  revalidatePath(`${FINANCE_PATH}/expenses/${row.expense_id}`);
  return { error: null };
}

// ---------------------------------------------------------------------------
// Delete / remove helpers
// ---------------------------------------------------------------------------

/** Elimina un gasto. Permitido en estado 'draft' o 'cancelled'. */
export async function deleteExpense(id: string): Promise<ActionResult> {
  const denied = await assertPermission('manage_finances');
  if (denied) return denied;

  const user = await getCurrentUser();

  const { data: expense } = await supabaseAdmin
    .from('finance_expenses')
    .select('status, title')
    .eq('id', id)
    .maybeSingle();

  if (!expense) return { error: 'Gasto no encontrado.' };
  if (!['draft', 'cancelled'].includes(expense.status)) {
    return { error: 'Solo se pueden eliminar gastos en estado Borrador o Cancelado.' };
  }

  // Eliminar adjuntos en storage (best-effort)
  const { data: attachments } = await supabaseAdmin
    .from('finance_attachments')
    .select('file_path')
    .eq('expense_id', id)
    .eq('is_active', true);

  if (attachments && attachments.length > 0) {
    await supabaseAdmin.storage
      .from('finance-files')
      .remove(attachments.map((a: { file_path: string }) => a.file_path));
  }

  const { error } = await supabaseAdmin
    .from('finance_expenses')
    .delete()
    .eq('id', id);

  if (error) return { error: error.message };

  await logActivity('expense', id, 'deleted', user?.profile?.id ?? null, { title: expense.title });
  revalidateFinancePaths();
  return { error: null };
}

/**
 * Elimina permanentemente un presupuesto.
 * Solo se permite si el presupuesto está en estado 'cancelled'.
 * Elimina en cascada todas las partidas y artículos vinculados (ON DELETE CASCADE en DB).
 */
export async function deleteBudget(id: string): Promise<ActionResult> {
  const denied = await assertPermission('manage_finances');
  if (denied) return denied;

  const user = await getCurrentUser();

  const { data: budget } = await supabaseAdmin
    .from('finance_budgets')
    .select('status, name')
    .eq('id', id)
    .maybeSingle();

  if (!budget) return { error: 'Presupuesto no encontrado.' };
  if (budget.status !== 'cancelled') {
    return { error: 'Solo se pueden eliminar presupuestos en estado Cancelado.' };
  }

  const { error } = await supabaseAdmin
    .from('finance_budgets')
    .delete()
    .eq('id', id);

  if (error) return { error: error.message };

  await logActivity('budget', id, 'deleted', user?.profile?.id ?? null, { name: budget.name });
  revalidateFinancePaths();
  return { error: null };
}

/** Cancela un presupuesto (cambia status a 'cancelled'). */
export async function cancelBudget(id: string): Promise<ActionResult> {
  const denied = await assertPermission('manage_finances');
  if (denied) return denied;

  const user = await getCurrentUser();

  const { error } = await supabaseAdmin
    .from('finance_budgets')
    .update({ status: 'cancelled' })
    .eq('id', id);

  if (error) return { error: error.message };

  await logActivity('budget', id, 'cancelled', user?.profile?.id ?? null);
  revalidateFinancePaths([`${FINANCE_PATH}/budgets/${id}`]);
  return { error: null };
}

/** Actualiza una partida presupuestal. */
export async function updateBudgetItem(
  id: string,
  formData: FormData
): Promise<ActionResult> {
  const denied = await assertPermission('manage_finances');
  if (denied) return denied;

  const user = await getCurrentUser();

  const raw = {
    budget_id:   formData.get('budget_id'),
    category_id: formData.get('category_id') || undefined,
    name:        formData.get('name'),
    description: formData.get('description'),
    amount:      formData.get('amount'),
  };

  const parsed = budgetItemSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { error } = await supabaseAdmin
    .from('finance_budget_items')
    .update({
      category_id: parsed.data.category_id ?? null,
      name:        parsed.data.name,
      description: parsed.data.description ?? null,
      amount:      parsed.data.amount,
    })
    .eq('id', id);

  if (error) return { error: error.message };

  await logActivity('budget', parsed.data.budget_id, 'item_updated', user?.profile?.id ?? null, { item_id: id });
  revalidateFinancePaths([`${FINANCE_PATH}/budgets/${parsed.data.budget_id}`]);
  return { error: null };
}

/** Elimina una partida presupuestal. */
export async function deleteBudgetItem(id: string, budgetId: string): Promise<ActionResult> {
  const denied = await assertPermission('manage_finances');
  if (denied) return denied;

  const user = await getCurrentUser();

  const { error } = await supabaseAdmin
    .from('finance_budget_items')
    .delete()
    .eq('id', id);

  if (error) return { error: error.message };

  await logActivity('budget', budgetId, 'item_deleted', user?.profile?.id ?? null, { item_id: id });
  revalidateFinancePaths([`${FINANCE_PATH}/budgets/${budgetId}`]);
  return { error: null };
}

// ---------------------------------------------------------------------------
// Budget Line Items (artículos detallados del presupuesto)
// ---------------------------------------------------------------------------

export type BudgetLineItem = {
  id: string;
  budget_id: string;
  tipo_equipo: string;
  disciplina: string;
  articulo: string;
  unidades: number;
  precio_unitario: number;
  total: number;
  notas: string | null;
  created_at: string;
  updated_at: string;
};

export async function listBudgetLineItems(
  budgetId: string,
  filters?: { tipo_equipo?: string; disciplina?: string; search?: string }
): Promise<BudgetLineItem[]> {
  const denied = await assertPermission('view_finances');
  if (denied) return [];

  let query = supabaseAdmin
    .from('finance_budget_line_items')
    .select('*')
    .eq('budget_id', budgetId)
    .order('tipo_equipo')
    .order('disciplina')
    .order('articulo');

  if (filters?.tipo_equipo) query = query.eq('tipo_equipo', filters.tipo_equipo);
  if (filters?.disciplina)  query = query.eq('disciplina',  filters.disciplina);
  if (filters?.search)      query = query.ilike('articulo',  `%${filters.search}%`);

  const { data } = await query;
  return (data ?? []) as BudgetLineItem[];
}

export async function createBudgetLineItem(
  formData: FormData
): Promise<{ error: string | null; id?: string }> {
  const denied = await assertPermission('manage_finances');
  if (denied) return denied;

  const budget_id       = (formData.get('budget_id')       as string)?.trim();
  const tipo_equipo     = (formData.get('tipo_equipo')     as string)?.trim();
  const disciplina      = (formData.get('disciplina')      as string)?.trim();
  const articulo        = (formData.get('articulo')        as string)?.trim();
  const unidades        = parseFloat((formData.get('unidades')        as string) ?? '1');
  const precio_unitario = parseFloat((formData.get('precio_unitario') as string) ?? '0');
  const notas           = (formData.get('notas') as string)?.trim() || null;

  if (!budget_id || !tipo_equipo || !disciplina || !articulo)
    return { error: 'Tipo de equipo, disciplina/ciudad y artículo son requeridos.' };
  if (isNaN(unidades) || unidades <= 0)        return { error: 'Unidades debe ser mayor a 0.' };
  if (isNaN(precio_unitario) || precio_unitario < 0) return { error: 'Precio unitario inválido.' };

  const { data, error } = await supabaseAdmin
    .from('finance_budget_line_items')
    .insert({ budget_id, tipo_equipo, disciplina, articulo, unidades, precio_unitario, notas })
    .select('id')
    .single();

  if (error) return { error: error.message };

  revalidateFinancePaths([`${FINANCE_PATH}/budgets/${budget_id}`]);
  return { error: null, id: data.id };
}

export async function updateBudgetLineItem(
  id: string,
  formData: FormData
): Promise<ActionResult> {
  const denied = await assertPermission('manage_finances');
  if (denied) return denied;

  const tipo_equipo     = (formData.get('tipo_equipo')     as string)?.trim();
  const disciplina      = (formData.get('disciplina')      as string)?.trim();
  const articulo        = (formData.get('articulo')        as string)?.trim();
  const unidades        = parseFloat((formData.get('unidades')        as string) ?? '1');
  const precio_unitario = parseFloat((formData.get('precio_unitario') as string) ?? '0');
  const notas           = (formData.get('notas') as string)?.trim() || null;
  const budget_id       = (formData.get('budget_id') as string)?.trim();

  if (!tipo_equipo || !disciplina || !articulo)
    return { error: 'Tipo de equipo, disciplina y artículo son requeridos.' };

  const { error } = await supabaseAdmin
    .from('finance_budget_line_items')
    .update({ tipo_equipo, disciplina, articulo, unidades, precio_unitario, notas })
    .eq('id', id);

  if (error) return { error: error.message };

  revalidateFinancePaths([`${FINANCE_PATH}/budgets/${budget_id}`]);
  return { error: null };
}

export async function deleteBudgetLineItem(
  id: string,
  budgetId: string
): Promise<ActionResult> {
  const denied = await assertPermission('manage_finances');
  if (denied) return denied;

  const { error } = await supabaseAdmin
    .from('finance_budget_line_items')
    .delete()
    .eq('id', id);

  if (error) return { error: error.message };

  revalidateFinancePaths([`${FINANCE_PATH}/budgets/${budgetId}`]);
  return { error: null };
}

// ---------------------------------------------------------------------------
// Supplier Attachments (CSF + documentos generales)
// ---------------------------------------------------------------------------

export type SupplierAttachment = {
  id: string;
  supplier_id: string;
  attachment_type: 'csf' | 'document';
  file_name_original: string;
  file_name_storage: string;
  file_path: string;
  mime_type: string;
  file_extension: string;
  file_size: number;
  description: string | null;
  uploaded_by: string | null;
  uploaded_at: string;
  is_active: boolean;
};

export async function listSupplierAttachments(supplierId: string): Promise<SupplierAttachment[]> {
  const denied = await assertPermission('view_finances');
  if (denied) return [];
  const { data } = await supabaseAdmin
    .from('finance_supplier_attachments')
    .select('*')
    .eq('supplier_id', supplierId)
    .eq('is_active', true)
    .order('uploaded_at', { ascending: false });
  return (data ?? []) as SupplierAttachment[];
}

export async function uploadSupplierAttachment(
  supplierId: string,
  attachmentType: 'csf' | 'document',
  formData: FormData
): Promise<{ errors: string[]; uploaded: number }> {
  const denied = await assertPermission('manage_finances');
  if (denied) return { errors: [denied.error], uploaded: 0 };

  const user = await getCurrentUser();
  const files = formData.getAll('files') as File[];
  if (!files.length || (files.length === 1 && files[0].size === 0))
    return { errors: ['No se seleccionaron archivos.'], uploaded: 0 };

  const uploadErrors: string[] = [];
  let uploaded = 0;

  for (const file of files) {
    if (file.size > FINANCE_MAX_FILE_SIZE_BYTES) {
      uploadErrors.push(`"${file.name}" excede 50 MB.`);
      continue;
    }
    const ext = file.name.split('.').pop() ?? 'bin';
    const storageName = `suppliers/${supplierId}/${attachmentType}-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error: upErr } = await supabaseAdmin.storage
      .from('finance-files')
      .upload(storageName, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: false });
    if (upErr) { uploadErrors.push(`"${file.name}": ${upErr.message}`); continue; }
    const { error: dbErr } = await supabaseAdmin.from('finance_supplier_attachments').insert({
      supplier_id: supplierId, attachment_type: attachmentType,
      file_name_original: file.name, file_name_storage: storageName, file_path: storageName,
      mime_type: file.type, file_extension: ext, file_size: file.size,
      uploaded_by: user?.profile?.id ?? null,
    });
    if (dbErr) { await supabaseAdmin.storage.from('finance-files').remove([storageName]); uploadErrors.push(`"${file.name}": ${dbErr.message}`); continue; }
    uploaded++;
  }

  revalidateFinancePaths([`${FINANCE_PATH}/suppliers`]);
  return { errors: uploadErrors, uploaded };
}

export async function deleteSupplierAttachment(attachmentId: string): Promise<ActionResult> {
  const denied = await assertPermission('manage_finances');
  if (denied) return denied;
  const user = await getCurrentUser();
  const { data: row } = await supabaseAdmin.from('finance_supplier_attachments')
    .select('supplier_id, file_path').eq('id', attachmentId).single();
  if (!row) return { error: 'Adjunto no encontrado.' };
  await supabaseAdmin.from('finance_supplier_attachments')
    .update({ is_active: false, deleted_by: user?.profile?.id ?? null, deleted_at: new Date().toISOString() })
    .eq('id', attachmentId);
  revalidateFinancePaths([`${FINANCE_PATH}/suppliers`]);
  return { error: null };
}

export async function getSupplierAttachmentSignedUrl(filePath: string): Promise<string | null> {
  const denied = await assertPermission('view_finances');
  if (denied) return null;
  const { data } = await supabaseAdmin.storage.from('finance-files').createSignedUrl(filePath, 3600);
  return data?.signedUrl ?? null;
}

// ---------------------------------------------------------------------------
// Payment Attachments (comprobantes de pago)
// ---------------------------------------------------------------------------

export type PaymentAttachment = {
  id: string;
  payment_id: string;
  file_name_original: string;
  file_name_storage: string;
  file_path: string;
  mime_type: string;
  file_extension: string;
  file_size: number;
  description: string | null;
  uploaded_by: string | null;
  uploaded_at: string;
  is_active: boolean;
};

export async function listPaymentAttachments(paymentId: string): Promise<PaymentAttachment[]> {
  const denied = await assertPermission('view_finances');
  if (denied) return [];
  const { data } = await supabaseAdmin
    .from('finance_payment_attachments')
    .select('*')
    .eq('payment_id', paymentId)
    .eq('is_active', true)
    .order('uploaded_at', { ascending: false });
  return (data ?? []) as PaymentAttachment[];
}

export async function uploadPaymentAttachment(
  paymentId: string,
  formData: FormData
): Promise<{ errors: string[]; uploaded: number }> {
  const denied = await assertPermission('manage_finances');
  if (denied) return { errors: [denied.error], uploaded: 0 };

  const user = await getCurrentUser();
  const files = formData.getAll('files') as File[];
  if (!files.length || (files.length === 1 && files[0].size === 0))
    return { errors: ['No se seleccionaron archivos.'], uploaded: 0 };

  const uploadErrors: string[] = [];
  let uploaded = 0;

  for (const file of files) {
    if (file.size > FINANCE_MAX_FILE_SIZE_BYTES) { uploadErrors.push(`"${file.name}" excede 50 MB.`); continue; }
    const ext = file.name.split('.').pop() ?? 'bin';
    const storageName = `payments/${paymentId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error: upErr } = await supabaseAdmin.storage
      .from('finance-files')
      .upload(storageName, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: false });
    if (upErr) { uploadErrors.push(`"${file.name}": ${upErr.message}`); continue; }
    const { error: dbErr } = await supabaseAdmin.from('finance_payment_attachments').insert({
      payment_id: paymentId,
      file_name_original: file.name, file_name_storage: storageName, file_path: storageName,
      mime_type: file.type, file_extension: ext, file_size: file.size,
      uploaded_by: user?.profile?.id ?? null,
    });
    if (dbErr) { await supabaseAdmin.storage.from('finance-files').remove([storageName]); uploadErrors.push(`"${file.name}": ${dbErr.message}`); continue; }
    uploaded++;
  }

  revalidateFinancePaths([`${FINANCE_PATH}/payments`]);
  return { errors: uploadErrors, uploaded };
}

export async function deletePaymentAttachment(attachmentId: string): Promise<ActionResult> {
  const denied = await assertPermission('manage_finances');
  if (denied) return denied;
  const user = await getCurrentUser();
  await supabaseAdmin.from('finance_payment_attachments')
    .update({ is_active: false, deleted_by: user?.profile?.id ?? null, deleted_at: new Date().toISOString() })
    .eq('id', attachmentId);
  revalidateFinancePaths([`${FINANCE_PATH}/payments`]);
  return { error: null };
}

export async function getPaymentAttachmentSignedUrl(filePath: string): Promise<string | null> {
  const denied = await assertPermission('view_finances');
  if (denied) return null;
  const { data } = await supabaseAdmin.storage.from('finance-files').createSignedUrl(filePath, 3600);
  return data?.signedUrl ?? null;
}

/** Desactiva una categoría de gasto. */
export async function deactivateExpenseCategory(id: string): Promise<ActionResult> {
  const denied = await assertPermission('manage_finances');
  if (denied) return denied;

  const { error } = await supabaseAdmin
    .from('finance_expense_categories')
    .update({ is_active: false })
    .eq('id', id);

  if (error) return { error: error.message };
  revalidateFinancePaths();
  return { error: null };
}

// ---------------------------------------------------------------------------
// Summary / Reports
// ---------------------------------------------------------------------------

export type RawExpense = {
  id: string;
  title: string;
  amount: number;
  status: string;
  disciplina: string | null;
  expense_date: string; // 'YYYY-MM-DD'
  category_id: string;
  category_name: string;
  category_color: string | null;
};

export type RawPayment = {
  id: string;
  amount: number;
  payment_date: string; // 'YYYY-MM-DD'
  payment_method: string;
  expense_title: string;
  expense_disciplina: string | null;
  expense_category_name: string;
};

export type FinanceReportData = {
  summary: FinanceSummary;
  by_disciplina: { disciplina: string; total: number; count: number }[];
  by_month: { month: string; total: number; count: number }[];
  by_budget: { name: string; total_amount: number; exercised: number }[];
  by_payment_method: { method: string; total: number; count: number }[];
  top_expenses: { title: string; amount: number; disciplina: string | null; status: string }[];
  total_payments: number;
  payments_count: number;
  // Raw data for client-side filtering
  raw_expenses: RawExpense[];
  raw_payments: RawPayment[];
  all_categories: { id: string; name: string; color: string | null }[];
  all_disciplinas: string[];
};

/**
 * Obtiene todos los datos necesarios para la página de reportes:
 * resumen, desglose por disciplina, tendencia mensual, presupuestos vs ejercido,
 * métodos de pago y top gastos.
 */
export async function getFinanceReportData(): Promise<FinanceReportData> {
  const denied = await assertPermission('view_finance_reports');

  const empty: FinanceReportData = {
    summary: {
      total_budget: 0, total_exercised: 0, total_available: 0,
      pending_approval_count: 0, pending_approval_amount: 0,
      by_category: [], by_status: [],
      athlete_expenses_total: 0, athlete_expenses_count: 0,
    },
    by_disciplina: [], by_month: [], by_budget: [],
    by_payment_method: [], top_expenses: [],
    total_payments: 0, payments_count: 0,
    raw_expenses: [], raw_payments: [],
    all_categories: [], all_disciplinas: [],
  };

  if (denied) return empty;

  // Fetch all data in parallel
  const [summaryData, expensesRaw, budgetsRaw, paymentsRaw] = await Promise.all([
    getFinanceSummary(),
    supabaseAdmin.from('finance_expenses').select(
      'id, title, amount, status, disciplina, expense_date, athlete_id, category_id, ' +
      'category:finance_expense_categories(name, color)'
    ),
    supabaseAdmin.from('finance_budgets').select('id, name, total_amount, status'),
    supabaseAdmin.from('finance_payments').select('amount, payment_method, payment_date'),
  ]);

  const expenses = (expensesRaw.data ?? []) as unknown as Array<{
    id: string; title: string; amount: number; status: string;
    disciplina: string | null; expense_date: string;
    athlete_id: string | null; category_id: string;
    category: { name: string; color: string | null } | null;
  }>;

  const budgets = (budgetsRaw.data ?? []) as Array<{
    id: string; name: string; total_amount: number; status: string;
  }>;

  const payments = (paymentsRaw.data ?? []) as Array<{
    amount: number; payment_method: string; payment_date: string;
  }>;

  // ── Por disciplina ─────────────────────────────────────────────────────────
  const disciplinaMap = new Map<string, { total: number; count: number }>();
  for (const e of expenses) {
    const key = e.disciplina ?? 'Sin disciplina';
    const prev = disciplinaMap.get(key) ?? { total: 0, count: 0 };
    disciplinaMap.set(key, { total: prev.total + e.amount, count: prev.count + 1 });
  }
  const by_disciplina = [...disciplinaMap.entries()]
    .map(([disciplina, v]) => ({ disciplina, ...v }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 15); // top 15

  // ── Tendencia mensual ──────────────────────────────────────────────────────
  const monthMap = new Map<string, { total: number; count: number }>();
  for (const e of expenses) {
    if (!e.expense_date) continue;
    const month = e.expense_date.slice(0, 7); // 'YYYY-MM'
    const prev = monthMap.get(month) ?? { total: 0, count: 0 };
    monthMap.set(month, { total: prev.total + e.amount, count: prev.count + 1 });
  }
  const by_month = [...monthMap.entries()]
    .map(([month, v]) => ({ month, ...v }))
    .sort((a, b) => a.month.localeCompare(b.month))
    .slice(-12); // últimos 12 meses

  // ── Presupuesto vs ejercido por presupuesto ────────────────────────────────
  const { data: budgetItems } = await supabaseAdmin
    .from('finance_expenses')
    .select('budget_item_id, amount, status')
    .in('status', ['approved', 'paid']);

  // Simple approach: show total budget amount vs total exercised (global)
  const by_budget = budgets.map(b => ({
    name: b.name.length > 30 ? b.name.slice(0, 28) + '…' : b.name,
    total_amount: b.total_amount,
    exercised: 0, // will be approximated by status
  }));
  // Distribute exercised proportionally (best effort without budget_id on expense)
  if (by_budget.length > 0) {
    const totalBudget = by_budget.reduce((s, b) => s + b.total_amount, 0);
    const totalExercised = summaryData.total_exercised;
    for (const b of by_budget) {
      b.exercised = totalBudget > 0
        ? Math.round((b.total_amount / totalBudget) * totalExercised)
        : 0;
    }
  }

  // ── Métodos de pago ────────────────────────────────────────────────────────
  const methodMap = new Map<string, { total: number; count: number }>();
  for (const p of payments) {
    const key = p.payment_method;
    const prev = methodMap.get(key) ?? { total: 0, count: 0 };
    methodMap.set(key, { total: prev.total + p.amount, count: prev.count + 1 });
  }
  const by_payment_method = [...methodMap.entries()]
    .map(([method, v]) => ({ method, ...v }))
    .sort((a, b) => b.total - a.total);

  // ── Top gastos ─────────────────────────────────────────────────────────────
  const top_expenses = [...expenses]
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 10)
    .map(e => ({ title: e.title, amount: e.amount, disciplina: e.disciplina, status: e.status }));

  // ── Totales de pagos ───────────────────────────────────────────────────────
  const total_payments = payments.reduce((s, p) => s + p.amount, 0);
  const payments_count = payments.length;

  // ── Datos crudos para filtrado client-side ─────────────────────────────────
  const raw_expenses: RawExpense[] = expenses.map(e => ({
    id: e.id,
    title: e.title,
    amount: e.amount,
    status: e.status,
    disciplina: e.disciplina,
    expense_date: e.expense_date,
    category_id: e.category_id,
    category_name: e.category?.name ?? 'Sin categoría',
    category_color: e.category?.color ?? null,
  }));

  // Expenses map para enriquecer pagos
  const expensesTitleMap = new Map(expenses.map(e => [e.id, {
    title: e.title,
    disciplina: e.disciplina,
    category_name: e.category?.name ?? 'Sin categoría',
  }]));

  const { data: paymentsWithId } = await supabaseAdmin
    .from('finance_payments')
    .select('id, amount, payment_date, payment_method, expense_id')
    .order('payment_date', { ascending: false });

  const raw_payments: RawPayment[] = ((paymentsWithId ?? []) as Array<{
    id: string; amount: number; payment_date: string;
    payment_method: string; expense_id: string;
  }>).map(p => {
    const exp = expensesTitleMap.get(p.expense_id);
    return {
      id: p.id,
      amount: p.amount,
      payment_date: p.payment_date,
      payment_method: p.payment_method,
      expense_title: exp?.title ?? 'Gasto desvinculado',
      expense_disciplina: exp?.disciplina ?? null,
      expense_category_name: exp?.category_name ?? 'Sin categoría',
    };
  });

  const all_categories = [...new Map(
    expenses.map(e => [e.category_id, {
      id: e.category_id,
      name: e.category?.name ?? 'Sin categoría',
      color: e.category?.color ?? null,
    }])
  ).values()].sort((a, b) => a.name.localeCompare(b.name));

  const all_disciplinas = [...new Set(
    expenses.map(e => e.disciplina).filter((d): d is string => d !== null)
  )].sort();

  return {
    summary: summaryData,
    by_disciplina,
    by_month,
    by_budget,
    by_payment_method,
    top_expenses,
    total_payments,
    payments_count,
    raw_expenses,
    raw_payments,
    all_categories,
    all_disciplinas,
  };
}

export async function getFinanceSummary(): Promise<FinanceSummary> {
  const denied = await assertPermission('view_finance_reports');
  const empty: FinanceSummary = {
    total_budget: 0,
    total_exercised: 0,
    total_available: 0,
    pending_approval_count: 0,
    pending_approval_amount: 0,
    by_category: [],
    by_status: [],
    athlete_expenses_total: 0,
    athlete_expenses_count: 0,
  };
  if (denied) return empty;

  // 1. Total budget from active budgets
  const { data: budgets } = await supabaseAdmin
    .from('finance_budgets')
    .select('total_amount')
    .eq('status', 'active');

  const total_budget = (budgets ?? []).reduce(
    (sum: number, b: { total_amount: number }) => sum + (b.total_amount ?? 0),
    0
  );

  // 2. All expenses
  const { data: expenses } = await supabaseAdmin
    .from('finance_expenses')
    .select(
      'id, amount, status, athlete_id, category_id, ' +
      'category:finance_expense_categories(name, color)'
    );

  const allExpenses = (expenses ?? []) as unknown as Array<{
    id: string;
    amount: number;
    status: string;
    athlete_id: string | null;
    category_id: string;
    category: { name: string; color: string | null } | null;
  }>;

  const total_exercised = allExpenses
    .filter((e) => ['approved', 'paid'].includes(e.status))
    .reduce((sum, e) => sum + e.amount, 0);

  const pendingExpenses = allExpenses.filter((e) => e.status === 'submitted');
  const pending_approval_count  = pendingExpenses.length;
  const pending_approval_amount = pendingExpenses.reduce((sum, e) => sum + e.amount, 0);

  // by_category
  const categoryMap = new Map<string, { category_name: string; color: string | null; total: number }>();
  for (const e of allExpenses) {
    const key = e.category_id;
    const cat = e.category;
    if (!categoryMap.has(key)) {
      categoryMap.set(key, {
        category_name: cat?.name ?? 'Sin categoría',
        color: cat?.color ?? null,
        total: 0,
      });
    }
    categoryMap.get(key)!.total += e.amount;
  }
  const by_category = [...categoryMap.values()].sort((a, b) => b.total - a.total);

  // by_status
  const statusMap = new Map<string, { status: string; total: number; count: number }>();
  for (const e of allExpenses) {
    if (!statusMap.has(e.status)) statusMap.set(e.status, { status: e.status, total: 0, count: 0 });
    const s = statusMap.get(e.status)!;
    s.total += e.amount;
    s.count++;
  }
  const by_status = [...statusMap.values()] as FinanceSummary['by_status'];

  // athlete expenses
  const athleteExpenses = allExpenses.filter((e) => e.athlete_id !== null);
  const athlete_expenses_total = athleteExpenses.reduce((sum, e) => sum + e.amount, 0);
  const athlete_expenses_count = athleteExpenses.length;

  return {
    total_budget,
    total_exercised,
    total_available: total_budget - total_exercised,
    pending_approval_count,
    pending_approval_amount,
    by_category,
    by_status,
    athlete_expenses_total,
    athlete_expenses_count,
  };
}
