import { z } from 'zod';

// =============================================================================
// Enums / constantes
// =============================================================================

export const EXPENSE_STATUSES = [
  'draft',
  'submitted',
  'approved',
  'rejected',
  'paid',
  'cancelled',
] as const;
export type ExpenseStatus = (typeof EXPENSE_STATUSES)[number];

export const BUDGET_STATUSES = ['draft', 'active', 'closed', 'cancelled'] as const;
export type BudgetStatus = (typeof BUDGET_STATUSES)[number];

export const PAYMENT_METHODS = ['transfer', 'check', 'cash', 'card', 'other'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const APPROVAL_ACTIONS = [
  'submitted',
  'approved',
  'rejected',
  'paid',
  'cancelled',
] as const;
export type ApprovalAction = (typeof APPROVAL_ACTIONS)[number];

// =============================================================================
// DB row types
// =============================================================================

export type FinanceExpenseCategory = {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  is_active: boolean;
  created_at: string;
};

export type FinanceSupplier = {
  id: string;
  name: string;
  rfc: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  disciplina: string | null;
  notes: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type FinanceBudget = {
  id: string;
  name: string;
  description: string | null;
  fiscal_year: number;
  start_date: string;
  end_date: string;
  total_amount: number;
  status: BudgetStatus;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type FinanceBudgetItem = {
  id: string;
  budget_id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  amount: number;
  created_at: string;
  updated_at: string;
  // joined
  category?: FinanceExpenseCategory | null;
};

export type FinanceExpense = {
  id: string;
  budget_item_id: string | null;
  category_id: string;
  supplier_id: string | null;
  athlete_id: string | null;
  disciplina: string | null;
  title: string;
  description: string | null;
  amount: number;
  expense_date: string;
  invoice_number: string | null;
  status: ExpenseStatus;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  // joined
  category?: FinanceExpenseCategory | null;
  supplier?: Pick<FinanceSupplier, 'id' | 'name'> | null;
  athlete?: { id: string; first_name: string; last_name: string } | null;
  creator?: { id: string; first_name: string; last_name: string } | null;
};

export type FinancePayment = {
  id: string;
  expense_id: string;
  amount: number;
  payment_date: string;
  payment_method: PaymentMethod;
  reference: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
};

export type FinanceAttachment = {
  id: string;
  expense_id: string;
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
  deleted_by: string | null;
  deleted_at: string | null;
};

export type FinanceApproval = {
  id: string;
  expense_id: string;
  action: ApprovalAction;
  performed_by: string;
  notes: string | null;
  created_at: string;
  // joined
  performer?: { id: string; first_name: string; last_name: string } | null;
};

// =============================================================================
// Zod validation schemas
// =============================================================================

export const budgetSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido').max(200),
  description: z.string().max(1000).optional(),
  fiscal_year: z.coerce
    .number()
    .int()
    .min(2000)
    .max(2100),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido'),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido'),
  total_amount: z.coerce.number().min(0, 'El monto debe ser mayor o igual a 0'),
  status: z.enum(BUDGET_STATUSES).default('active'),
  notes: z.string().max(2000).optional(),
});
export type BudgetInput = z.infer<typeof budgetSchema>;

export const budgetItemSchema = z.object({
  budget_id: z.string().uuid(),
  category_id: z.string().uuid().optional(),
  name: z.string().min(1, 'El nombre es requerido').max(200),
  description: z.string().max(1000).optional(),
  amount: z.coerce.number().min(0, 'El monto debe ser mayor o igual a 0'),
});
export type BudgetItemInput = z.infer<typeof budgetItemSchema>;

export const expenseSchema = z.object({
  budget_item_id: z.string().uuid().optional(),
  category_id: z.string().uuid({ message: 'Selecciona una categoría' }),
  supplier_id: z.string().uuid().optional(),
  athlete_id: z.string().uuid().optional(),
  disciplina: z.string().max(100).optional(),
  title: z.string().min(1, 'El título es requerido').max(300),
  description: z.string().max(2000).optional(),
  amount: z.coerce.number().positive('El monto debe ser mayor a 0'),
  expense_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido'),
  invoice_number: z.string().max(100).optional(),
  notes: z.string().max(2000).optional(),
});
export type ExpenseInput = z.infer<typeof expenseSchema>;

export const supplierSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido').max(200),
  rfc: z.string().max(20).optional(),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  phone: z.string().max(30).optional(),
  address: z.string().max(500).optional(),
  disciplina: z.string().max(100).optional(),
  notes: z.string().max(1000).optional(),
});
export type SupplierInput = z.infer<typeof supplierSchema>;

export const paymentSchema = z.object({
  expense_id: z.string().uuid(),
  amount: z.coerce.number().positive('El monto debe ser mayor a 0'),
  payment_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido'),
  payment_method: z.enum(PAYMENT_METHODS),
  reference: z.string().max(200).optional(),
  notes: z.string().max(1000).optional(),
});
export type PaymentInput = z.infer<typeof paymentSchema>;

export const approvalSchema = z.object({
  expense_id: z.string().uuid(),
  action: z.enum(['approved', 'rejected', 'paid', 'cancelled']),
  notes: z.string().max(1000).optional(),
});
export type ApprovalInput = z.infer<typeof approvalSchema>;

// =============================================================================
// Summary / reports types
// =============================================================================

export type FinanceSummary = {
  total_budget: number;
  total_exercised: number;       // approved + paid
  total_available: number;       // total_budget - total_exercised
  pending_approval_count: number;
  pending_approval_amount: number;
  by_category: { category_name: string; color: string | null; total: number }[];
  by_status: { status: ExpenseStatus; total: number; count: number }[];
  athlete_expenses_total: number;
  athlete_expenses_count: number;
};

// File upload helpers
export const FINANCE_ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'text/csv',
  'text/plain',
]);
export const FINANCE_MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB
