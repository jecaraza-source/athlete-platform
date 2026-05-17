'use server';

import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { assertPermission, getCurrentUser } from '@/lib/rbac/server';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PayrollEntry = {
  id: string;
  profile_id: string;
  period_label: string;
  period_start: string;
  period_end: string;
  gross_amount: number;
  expense_id: string | null;
  status: 'draft' | 'submitted' | 'approved' | 'paid' | 'cancelled';
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // joined
  profile?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string | null;
    role: string | null;
  } | null;
  expense?: {
    id: string;
    status: string;
    amount: number;
  } | null;
};

export type PayrollStaff = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  role: string | null;
  roles: { code: string; name: string }[];
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PAYROLL_PATH = '/finances/nomina';
const EXPENSES_PATH = '/finances/expenses';

function revalidate() {
  revalidatePath(PAYROLL_PATH);
  revalidatePath(EXPENSES_PATH);
  revalidatePath('/finances');
  revalidatePath('/finances/reports');
}

type AR = { error: string | null };
type ARI = AR & { id?: string };

// ---------------------------------------------------------------------------
// 1. Listar staff elegible para nómina
// ---------------------------------------------------------------------------

/** Devuelve todos los perfiles con al menos un rol de staff/técnico. */
export async function listPayrollStaff(): Promise<PayrollStaff[]> {
  const denied = await assertPermission('view_finances');
  if (denied) return [];

  // Roles elegibles para nómina
  const STAFF_ROLES = [
    'coach', 'staff', 'physio', 'nutritionist', 'psychologist', 'medic',
    'program_director', 'admin', 'super_admin', 'finance_admin',
  ];

  const { data: roleRows } = await supabaseAdmin
    .from('roles')
    .select('id, code, name')
    .in('code', STAFF_ROLES);

  const roleIds = (roleRows ?? []).map((r: { id: number }) => r.id);

  if (roleIds.length === 0) return [];

  const { data: urRows } = await supabaseAdmin
    .from('user_roles')
    .select('profile_id, roles(code, name)')
    .in('role_id', roleIds);

  if (!urRows || urRows.length === 0) return [];

  const profileIds = [...new Set((urRows as any[]).map(r => r.profile_id))];

  const { data: profiles } = await supabaseAdmin
    .from('profiles')
    .select('id, first_name, last_name, email, role')
    .in('id', profileIds)
    .order('last_name');

  if (!profiles) return [];

  // Build a map: profile_id → list of role objects
  const rolesMap = new Map<string, { code: string; name: string }[]>();
  for (const ur of urRows as any[]) {
    const existing = rolesMap.get(ur.profile_id) ?? [];
    const r = Array.isArray(ur.roles) ? ur.roles[0] : ur.roles;
    if (r) existing.push(r);
    rolesMap.set(ur.profile_id, existing);
  }

  return profiles.map((p: any) => ({
    id: p.id,
    first_name: p.first_name,
    last_name: p.last_name,
    email: p.email,
    role: p.role,
    roles: rolesMap.get(p.id) ?? [],
  }));
}

// ---------------------------------------------------------------------------
// 2. Listar entradas de nómina
// ---------------------------------------------------------------------------

export async function listPayroll(): Promise<PayrollEntry[]> {
  const denied = await assertPermission('view_finances');
  if (denied) return [];

  const { data } = await supabaseAdmin
    .from('finance_payroll')
    .select(`
      *,
      profile:profiles!profile_id(id, first_name, last_name, email, role),
      expense:finance_expenses!expense_id(id, status, amount)
    `)
    .order('period_end', { ascending: false })
    .order('created_at', { ascending: false });

  return (data ?? []) as unknown as PayrollEntry[];
}

// ---------------------------------------------------------------------------
// 3. Crear entrada de nómina + gasto vinculado
// ---------------------------------------------------------------------------

export async function createPayrollEntry(formData: FormData): Promise<ARI> {
  const denied = await assertPermission('manage_finances');
  if (denied) return denied;

  const user = await getCurrentUser();
  if (!user?.profile) return { error: 'Perfil no encontrado.' };

  const profile_id    = formData.get('profile_id') as string;
  const period_label  = (formData.get('period_label') as string)?.trim();
  const period_start  = formData.get('period_start') as string;
  const period_end    = formData.get('period_end') as string;
  const gross_amount  = parseFloat(formData.get('gross_amount') as string);
  const notes         = (formData.get('notes') as string)?.trim() || null;
  const send_to_review = formData.get('send_to_review') === 'true';

  if (!profile_id)   return { error: 'Selecciona el integrante del staff.' };
  if (!period_label) return { error: 'El período es requerido.' };
  if (!period_start || !period_end) return { error: 'Las fechas de período son requeridas.' };
  if (isNaN(gross_amount) || gross_amount <= 0) return { error: 'El monto bruto debe ser mayor a 0.' };

  // Obtener nombre del perfil para el título del gasto
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('first_name, last_name')
    .eq('id', profile_id)
    .maybeSingle();

  if (!profile) return { error: 'Perfil no encontrado.' };

  // Obtener categoría "Nóminas"
  const { data: nomCat } = await supabaseAdmin
    .from('finance_expense_categories')
    .select('id')
    .eq('name', 'Nóminas')
    .maybeSingle();

  if (!nomCat) return { error: 'Categoría "Nóminas" no encontrada. Aplica la migración 042.' };

  // 1. Crear el registro de nómina (sin expense_id aún)
  const { data: payrollRow, error: pr_err } = await supabaseAdmin
    .from('finance_payroll')
    .insert({
      profile_id,
      period_label,
      period_start,
      period_end,
      gross_amount,
      notes,
      created_by: user.profile.id,
      status: 'draft',
    })
    .select('id')
    .single();

  if (pr_err) return { error: pr_err.message };

  // 2. Crear el gasto vinculado
  const expenseTitle = `Nómina – ${profile.first_name} ${profile.last_name} – ${period_label}`;
  const { data: expenseRow, error: exp_err } = await supabaseAdmin
    .from('finance_expenses')
    .insert({
      category_id:  nomCat.id,
      title:        expenseTitle,
      amount:       gross_amount,
      expense_date: period_end,
      disciplina:   'NÓMINA',
      description:  `Período: ${period_start} al ${period_end}`,
      notes,
      created_by:   user.profile.id,
      status:       'draft',
    })
    .select('id')
    .single();

  if (exp_err) {
    // Limpiar: borrar el registro de nómina
    await supabaseAdmin.from('finance_payroll').delete().eq('id', payrollRow.id);
    return { error: exp_err.message };
  }

  // 3. Actualizar el registro de nómina con el expense_id
  await supabaseAdmin
    .from('finance_payroll')
    .update({ expense_id: expenseRow.id })
    .eq('id', payrollRow.id);

  // 4. Si se solicitó enviar a revisión, cambiar estado a submitted
  if (send_to_review) {
    await supabaseAdmin.from('finance_expenses')
      .update({ status: 'submitted' })
      .eq('id', expenseRow.id);

    await supabaseAdmin.from('finance_approvals').insert({
      expense_id:   expenseRow.id,
      action:       'submitted',
      performed_by: user.profile.id,
    });

    await supabaseAdmin.from('finance_payroll')
      .update({ status: 'submitted' })
      .eq('id', payrollRow.id);
  }

  revalidate();
  return { error: null, id: payrollRow.id };
}

// ---------------------------------------------------------------------------
// 4. Actualizar entrada de nómina (solo campos editables)
// ---------------------------------------------------------------------------

export async function updatePayrollEntry(id: string, formData: FormData): Promise<AR> {
  const denied = await assertPermission('manage_finances');
  if (denied) return denied;

  // Solo se puede editar en draft
  const { data: existing } = await supabaseAdmin
    .from('finance_payroll')
    .select('status, expense_id, gross_amount')
    .eq('id', id)
    .maybeSingle();

  if (!existing) return { error: 'Registro de nómina no encontrado.' };
  if (existing.status !== 'draft') return { error: 'Solo se pueden editar nóminas en estado Borrador.' };

  const period_label = (formData.get('period_label') as string)?.trim();
  const period_start = formData.get('period_start') as string;
  const period_end   = formData.get('period_end') as string;
  const gross_amount = parseFloat(formData.get('gross_amount') as string);
  const notes        = (formData.get('notes') as string)?.trim() || null;

  if (!period_label || !period_start || !period_end)
    return { error: 'El período es requerido.' };
  if (isNaN(gross_amount) || gross_amount <= 0)
    return { error: 'El monto bruto debe ser mayor a 0.' };

  const { error: upErr } = await supabaseAdmin
    .from('finance_payroll')
    .update({ period_label, period_start, period_end, gross_amount, notes })
    .eq('id', id);

  if (upErr) return { error: upErr.message };

  // Sincronizar el gasto vinculado
  if (existing.expense_id) {
    await supabaseAdmin.from('finance_expenses')
      .update({
        amount:       gross_amount,
        expense_date: period_end,
        notes,
        description:  `Período: ${period_start} al ${period_end}`,
      })
      .eq('id', existing.expense_id);
  }

  revalidate();
  return { error: null };
}

// ---------------------------------------------------------------------------
// 5. Eliminar entrada de nómina (solo en draft)
// ---------------------------------------------------------------------------

export async function deletePayrollEntry(id: string): Promise<AR> {
  const denied = await assertPermission('manage_finances');
  if (denied) return denied;

  const { data: existing } = await supabaseAdmin
    .from('finance_payroll')
    .select('status, expense_id')
    .eq('id', id)
    .maybeSingle();

  if (!existing) return { error: 'Registro de nómina no encontrado.' };
  if (existing.status !== 'draft') return { error: 'Solo se pueden eliminar nóminas en estado Borrador.' };

  // Cancelar / eliminar el gasto vinculado
  if (existing.expense_id) {
    await supabaseAdmin.from('finance_expenses')
      .delete()
      .eq('id', existing.expense_id)
      .eq('status', 'draft'); // solo si sigue en draft
  }

  const { error } = await supabaseAdmin
    .from('finance_payroll')
    .delete()
    .eq('id', id);

  if (error) return { error: error.message };

  revalidate();
  return { error: null };
}

// ---------------------------------------------------------------------------
// 6. Enviar a revisión (submit)
// ---------------------------------------------------------------------------

export async function submitPayrollEntry(id: string): Promise<AR> {
  const denied = await assertPermission('manage_finances');
  if (denied) return denied;

  const user = await getCurrentUser();
  if (!user?.profile) return { error: 'Perfil no encontrado.' };

  const { data: existing } = await supabaseAdmin
    .from('finance_payroll')
    .select('status, expense_id')
    .eq('id', id)
    .maybeSingle();

  if (!existing) return { error: 'Registro no encontrado.' };
  if (existing.status !== 'draft') return { error: 'Solo se pueden enviar a revisión nóminas en Borrador.' };

  if (existing.expense_id) {
    await supabaseAdmin.from('finance_expenses')
      .update({ status: 'submitted' })
      .eq('id', existing.expense_id);

    await supabaseAdmin.from('finance_approvals').insert({
      expense_id:   existing.expense_id,
      action:       'submitted',
      performed_by: user.profile.id,
    });
  }

  await supabaseAdmin.from('finance_payroll')
    .update({ status: 'submitted' })
    .eq('id', id);

  revalidate();
  return { error: null };
}

// ---------------------------------------------------------------------------
// 7. Sincronizar estado desde el gasto vinculado
// ---------------------------------------------------------------------------

/** Llama este action desde un webhook o manualmente para sincronizar. */
export async function syncPayrollStatus(payrollId: string): Promise<AR> {
  const denied = await assertPermission('approve_finances');
  if (denied) return denied;

  const { data: entry } = await supabaseAdmin
    .from('finance_payroll')
    .select('expense_id')
    .eq('id', payrollId)
    .maybeSingle();

  if (!entry?.expense_id) return { error: null }; // nada que sincronizar

  const { data: expense } = await supabaseAdmin
    .from('finance_expenses')
    .select('status')
    .eq('id', entry.expense_id)
    .maybeSingle();

  if (!expense) return { error: null };

  const validStatuses = ['draft', 'submitted', 'approved', 'paid', 'cancelled'];
  if (validStatuses.includes(expense.status)) {
    await supabaseAdmin.from('finance_payroll')
      .update({ status: expense.status })
      .eq('id', payrollId);
  }

  revalidate();
  return { error: null };
}

// ---------------------------------------------------------------------------
// 8. Resumen de nómina para reportes
// ---------------------------------------------------------------------------

export type PayrollSummary = {
  total_payroll: number;
  count: number;
  by_status: { status: string; total: number; count: number }[];
  by_period: { period_label: string; total: number; count: number }[];
  by_role: { role: string; total: number; count: number }[];
};

export async function getPayrollSummary(): Promise<PayrollSummary> {
  const denied = await assertPermission('view_finance_reports');
  const empty: PayrollSummary = { total_payroll: 0, count: 0, by_status: [], by_period: [], by_role: [] };
  if (denied) return empty;

  const { data } = await supabaseAdmin
    .from('finance_payroll')
    .select('gross_amount, status, period_label, profile:profiles!profile_id(role)');

  const entries = (data ?? []) as unknown as Array<{
    gross_amount: number;
    status: string;
    period_label: string;
    profile: { role: string | null } | null;
  }>;

  const total_payroll = entries.reduce((s, e) => s + e.gross_amount, 0);
  const count = entries.length;

  const statusMap = new Map<string, { total: number; count: number }>();
  const periodMap = new Map<string, { total: number; count: number }>();
  const roleMap   = new Map<string, { total: number; count: number }>();

  for (const e of entries) {
    const s = statusMap.get(e.status) ?? { total: 0, count: 0 };
    statusMap.set(e.status, { total: s.total + e.gross_amount, count: s.count + 1 });

    const p = periodMap.get(e.period_label) ?? { total: 0, count: 0 };
    periodMap.set(e.period_label, { total: p.total + e.gross_amount, count: p.count + 1 });

    const role = e.profile?.role ?? 'Sin rol';
    const r = roleMap.get(role) ?? { total: 0, count: 0 };
    roleMap.set(role, { total: r.total + e.gross_amount, count: r.count + 1 });
  }

  return {
    total_payroll,
    count,
    by_status:  [...statusMap.entries()].map(([status, v])       => ({ status, ...v })),
    by_period:  [...periodMap.entries()].map(([period_label, v]) => ({ period_label, ...v })).slice(-6),
    by_role:    [...roleMap.entries()].map(([role, v])            => ({ role, ...v })).sort((a, b) => b.total - a.total),
  };
}
