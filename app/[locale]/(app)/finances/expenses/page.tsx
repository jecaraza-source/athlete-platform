import { requirePermission, hasPermission, hasRole } from '@/lib/rbac/server';
import { listExpenses, getExpenseCategories, listSuppliers } from '@/lib/finance/actions';
import { ExpensesClient } from './expenses-client';
import { ExpensesTableClient } from './expenses-table';
import { Link } from '@/i18n/navigation';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getTranslations } from 'next-intl/server';

export default async function ExpensesPage() {
  await requirePermission('view_finances');

  const [expenses, categories, suppliers, canManage, canApprove, canAdminDelete, t] = await Promise.all([
    listExpenses(),
    getExpenseCategories(),
    listSuppliers(),
    hasPermission('manage_finances'),
    hasPermission('approve_finances'),
    hasRole('finance_admin'),
    getTranslations('finances'),
  ]);

  const { data: athletes } = await supabaseAdmin
    .from('athletes')
    .select('id, first_name, last_name')
    .order('last_name');

  const athleteList = (athletes ?? []) as { id: string; first_name: string; last_name: string }[];

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <Link href="/finances" className="text-sm text-indigo-600 hover:underline">
          ← {t('title')}
        </Link>
        <h1 className="mt-1 text-2xl font-bold text-gray-900">{t('expenses.title')}</h1>
        <p className="text-sm text-gray-500 mt-1">
          {expenses.length} {t('expenses.title').toLowerCase()}
        </p>
      </div>

      {canManage && (
        <ExpensesClient
          initialCategories={categories}
          suppliers={suppliers}
          athletes={athleteList}
        />
      )}

      <ExpensesTableClient
        expenses={expenses}
        categories={categories}
        suppliers={suppliers}
        athletes={athleteList}
        canManage={canManage}
        canApprove={canApprove}
        canAdminDelete={canAdminDelete}
      />
    </div>
  );
}
