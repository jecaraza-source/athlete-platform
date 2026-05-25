import { requirePermission, hasPermission } from '@/lib/rbac/server';
import { listBudgets } from '@/lib/finance/actions';
import { BudgetForm } from '@/components/finances/budget-form';
import { BudgetsListClient } from './budgets-list-client';
import { Link } from '@/i18n/navigation';
import { getTranslations } from 'next-intl/server';

export default async function BudgetsPage() {
  await requirePermission('view_finances');
  const [budgets, canManage, t] = await Promise.all([
    listBudgets(),
    hasPermission('manage_finances'),
    getTranslations('finances'),
  ]);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/finances" className="text-sm text-indigo-600 hover:underline">
            {t('budgets.backToBudgets')}
          </Link>
          <h1 className="mt-1 text-2xl font-bold text-gray-900">{t('budgets.title')}</h1>
        </div>
      </div>

      {canManage && (
        <details className="rounded-lg border border-indigo-200 bg-indigo-50 overflow-hidden">
          <summary className="px-5 py-3 cursor-pointer text-sm font-semibold text-indigo-700 select-none">
            {t('budgets.newBudget')}
          </summary>
          <div className="p-5 bg-white border-t border-indigo-100">
            <BudgetForm />
          </div>
        </details>
      )}

      {budgets.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-12 text-center">
          <p className="text-gray-500 text-sm">{t('budgets.empty')}</p>
          {canManage && (
            <p className="mt-2 text-xs text-gray-400">{t('budgets.emptyHint')}</p>
          )}
        </div>
      ) : (
        <BudgetsListClient budgets={budgets} canManage={canManage} />
      )}
    </div>
  );
}
