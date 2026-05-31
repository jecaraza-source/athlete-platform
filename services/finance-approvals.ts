/**
 * services/finance-approvals.ts
 *
 * Read/write service for the expense approval workflow on mobile.
 * Requires `approve_finances` permission (checked in the UI layer;
 * RLS policies on finance_expenses and finance_approvals enforce
 * this server-side as well).
 *
 * Approval flow:
 *   draft → submitted (manage_finances — web only)
 *   submitted → approved | rejected  (approve_finances)
 *   approved  → paid    | rejected  (approve_finances)
 *   any eligible → cancelled         (manage_finances — web only)
 */

import { supabase } from '@/lib/supabase';
import { notifyProfiles } from '@/services/notifications';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ExpenseForApproval = {
  id:             string;
  title:          string;
  amount:         number;
  status:         'submitted' | 'approved';
  expense_date:   string;
  disciplina:     string | null;
  description:    string | null;
  notes:          string | null;
  invoice_number: string | null;
  category_name:  string;
  category_color: string | null;
  supplier_name:  string | null;
};

export type ApprovalAction = 'approved' | 'rejected' | 'paid';

// ---------------------------------------------------------------------------
// Internal raw DB row shape
// ---------------------------------------------------------------------------

type RawExpense = {
  id:             string;
  title:          string;
  amount:         number;
  status:         string;
  expense_date:   string;
  disciplina:     string | null;
  description:    string | null;
  notes:          string | null;
  invoice_number: string | null;
  category_id:    string;
  category:       { name: string; color: string | null } | { name: string; color: string | null }[] | null;
  supplier:       { name: string } | { name: string }[] | null;
};

function flattenJoin<T>(raw: T | T[] | null): T | null {
  if (!raw) return null;
  if (Array.isArray(raw)) return raw[0] ?? null;
  return raw;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * Returns expenses that need an approval action, ordered oldest first
 * (most urgent first) so approvers see the backlog in chronological order.
 *
 * @param status  'submitted' → needs approve/reject
 *                'approved'  → can be marked paid or rejected
 */
export async function listExpensesForApproval(
  status: 'submitted' | 'approved',
): Promise<ExpenseForApproval[]> {
  const { data, error } = await supabase
    .from('finance_expenses')
    .select(
      'id, title, amount, status, expense_date, disciplina, ' +
      'description, notes, invoice_number, category_id, ' +
      'category:finance_expense_categories(name, color), ' +
      'supplier:finance_suppliers(name)'
    )
    .eq('status', status)
    .order('expense_date', { ascending: true });

  if (error) {
    console.warn('[finance-approvals] listExpenses error:', error.message);
    return [];
  }

  return ((data ?? []) as unknown as RawExpense[]).map((e) => {
    const cat = flattenJoin(e.category);
    const sup = flattenJoin(e.supplier);
    return {
      id:             e.id,
      title:          e.title,
      amount:         e.amount,
      status:         e.status as 'submitted' | 'approved',
      expense_date:   e.expense_date,
      disciplina:     e.disciplina,
      description:    e.description,
      notes:          e.notes,
      invoice_number: e.invoice_number,
      category_name:  cat?.name  ?? 'Sin categoría',
      category_color: cat?.color ?? null,
      supplier_name:  sup?.name  ?? null,
    };
  });
}

/**
 * Returns the count of expenses in 'submitted' status.
 * Used to drive the tab badge in the navigation bar.
 */
export async function countPendingApprovals(): Promise<number> {
  const { count } = await supabase
    .from('finance_expenses')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'submitted');
  return count ?? 0;
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/**
 * Processes an approval action on an expense.
 *
 * Performs two operations:
 *  1. Updates `finance_expenses.status` to the new action value.
 *  2. Inserts a record in `finance_approvals` with the performer + optional notes.
 *
 * Returns `{ error: null }` on success or `{ error: message }` if the
 * status update fails. An approval record insertion failure is logged but
 * is non-fatal (the status was already saved).
 *
 * Valid transitions enforced by the caller:
 *   submitted → approved | rejected
 *   approved  → paid    | rejected
 */
export async function processExpenseApproval(
  expenseId:   string,
  action:      ApprovalAction,
  performedBy: string,          // profiles.id of the approver
  notes?:      string | null,
): Promise<{ error: string | null }> {
  // 1. Update the expense status — SELECT the updated row to verify it worked
  const { data: updated, error: updateError } = await supabase
    .from('finance_expenses')
    .update({ status: action })
    .eq('id', expenseId)
    .select('id, status');

  if (updateError) {
    console.warn('[finance-approvals] update status error:', updateError.message);
    return { error: updateError.message };
  }

  // Detect silent RLS block: update returned no rows → policy denied
  if (!updated || updated.length === 0) {
    console.warn('[finance-approvals] update returned 0 rows — RLS may have blocked it');
    return {
      error: 'Sin permisos para actualizar este gasto. Contacta al administrador del sistema.',
    };
  }

  // 2. Record the approval action (best-effort — non-fatal on failure)
  const { error: insertError } = await supabase
    .from('finance_approvals')
    .insert({
      expense_id:   expenseId,
      action,
      performed_by: performedBy,
      notes:        notes?.trim() || null,
    });

  if (insertError) {
    console.warn('[finance-approvals] insert record error:', insertError.message);
    // Non-fatal: status was already updated successfully
  }

  return { error: null };
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

const ACTION_LABEL: Record<ApprovalAction, string> = {
  approved: 'Aprobado',
  rejected: 'Rechazado',
  paid:     'Marcado como pagado',
};

const ACTION_COLOR: Record<ApprovalAction, string> = {
  approved: '#16a34a',
  rejected: '#dc2626',
  paid:     '#1d4ed8',
};

/**
 * Sends an email to every staff member who holds the `approve_finances`
 * permission, informing them that an approval action was performed.
 *
 * Steps:
 *  1. Resolve the `approve_finances` permission ID.
 *  2. Find all role IDs that include this permission.
 *  3. Find all profile IDs assigned those roles.
 *  4. Exclude the performer (they already know what they did).
 *  5. Queue email_jobs via notifyProfiles().
 *
 * Designed to be called fire-and-forget: it catches all errors internally
 * so a notification failure never blocks the UI.
 */
export async function notifyFinanceApprovers(
  expense:             Pick<ExpenseForApproval, 'id' | 'title' | 'amount'>,
  action:              ApprovalAction,
  performedByProfileId: string,
  performedByName:     string,
  notes?:              string | null,
): Promise<void> {
  try {
    // 1. Get the permission ID for 'approve_finances'
    const { data: permRow } = await supabase
      .from('permissions')
      .select('id')
      .eq('name', 'approve_finances')
      .maybeSingle();

    if (!permRow?.id) {
      console.warn('[finance-approvals] approve_finances permission not found');
      return;
    }

    // 2. Find role IDs that include this permission
    const { data: rp } = await supabase
      .from('role_permissions')
      .select('role_id')
      .eq('permission_id', permRow.id);

    const roleIds = ((rp ?? []) as { role_id: number }[]).map((r) => r.role_id);
    if (!roleIds.length) return;

    // 3. Find profile IDs with those roles
    const { data: ur } = await supabase
      .from('user_roles')
      .select('profile_id')
      .in('role_id', roleIds);

    // De-duplicate and exclude the performer
    const recipientIds = [...new Set(
      ((ur ?? []) as { profile_id: string }[]).map((r) => r.profile_id),
    )].filter((id) => id !== performedByProfileId);

    if (!recipientIds.length) return;

    // 4. Build email content
    const fmtAmount = new Intl.NumberFormat('es-MX', {
      style: 'currency', currency: 'MXN', maximumFractionDigits: 0,
    }).format(expense.amount);

    const actionLabel = ACTION_LABEL[action];
    const actionColor = ACTION_COLOR[action];
    const notesRow    = notes?.trim()
      ? `<tr><td style="padding:4px 16px 4px 0;font-weight:600;white-space:nowrap;">Notas:</td><td style="padding:4px 0;">${notes.trim()}</td></tr>`
      : '';
    const notesPlain  = notes?.trim() ? `\nNotas: ${notes.trim()}` : '';

    const subject = `[Finanzas AO] ${actionLabel} — ${expense.title}`;

    const htmlBody = `
<div style="font-family:sans-serif;max-width:560px;margin:0 auto;">
  <h2 style="font-size:18px;margin-bottom:4px;">
    Actualización de gasto
  </h2>
  <p style="color:#64748b;font-size:14px;margin-top:0;">
    AO Deportes · Módulo de Finanzas
  </p>
  <table style="border-collapse:collapse;width:100%;font-size:14px;margin-top:16px;">
    <tr>
      <td style="padding:4px 16px 4px 0;font-weight:600;white-space:nowrap;">Gasto:</td>
      <td style="padding:4px 0;">${expense.title}</td>
    </tr>
    <tr>
      <td style="padding:4px 16px 4px 0;font-weight:600;white-space:nowrap;">Acción:</td>
      <td style="padding:4px 0;color:${actionColor};font-weight:700;">${actionLabel}</td>
    </tr>
    <tr>
      <td style="padding:4px 16px 4px 0;font-weight:600;white-space:nowrap;">Monto:</td>
      <td style="padding:4px 0;">${fmtAmount}</td>
    </tr>
    <tr>
      <td style="padding:4px 16px 4px 0;font-weight:600;white-space:nowrap;">Procesado por:</td>
      <td style="padding:4px 0;">${performedByName}</td>
    </tr>
    ${notesRow}
  </table>
  <p style="margin-top:20px;font-size:13px;color:#64748b;">
    Ingresa al portal web para revisar los detalles completos y el historial de autorizaciones.
  </p>
</div>`.trim();

    const plainBody =
      `FINANZAS AO — ${actionLabel}: ${expense.title}` +
      `\nMonto: ${fmtAmount}` +
      `\nProcesado por: ${performedByName}` +
      notesPlain +
      `\n\nIngresa al portal web para ver los detalles completos.`;

    // 5. Queue email jobs (fire-and-forget from caller's perspective)
    await notifyProfiles(recipientIds, {
      notifyPush:    false,
      notifyEmail:   true,
      entityType:    'finance',
      entityId:      expense.id,
      pushTitle:     subject,
      pushMessage:   `${expense.title} — ${fmtAmount}`,
      emailSubject:  subject,
      emailHtmlBody: htmlBody,
      emailPlainBody: plainBody,
    });

    console.log(`[finance-approvals] queued emails to ${recipientIds.length} approver(s)`);
  } catch (err) {
    // Non-fatal — the approval was already persisted; log and move on.
    console.warn('[finance-approvals] notifyFinanceApprovers error:', err);
  }
}
