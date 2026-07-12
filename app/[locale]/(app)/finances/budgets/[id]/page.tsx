import { notFound } from 'next/navigation';
import { requirePermission, hasPermission } from '@/lib/rbac/server';
import { getBudget, getBudgetItems, getExpenseCategories, listBudgetLineItems } from '@/lib/finance/actions';
import { BudgetDetailClient } from './budget-detail-client';
import { BudgetLineItemsClient } from './budget-line-items-client';
import { Link } from '@/i18n/navigation';
import { getTranslations } from 'next-intl/server';

export default async function BudgetDetailPage({
  params,
}: {
  params: Promise<{ id: string; tab?: string }>;
}) {
  await requirePermission('view_finances');

  const { id } = await params;

  const [budget, items, categories, lineItems, canManage, t] = await Promise.all([
    getBudget(id),
    getBudgetItems(id),
    getExpenseCategories(),
    listBudgetLineItems(id),
    hasPermission('manage_finances'),
    getTranslations('finances'),
  ]);

  if (!budget) notFound();

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <Link href="/finances/budgets" className="text-sm text-indigo-600 hover:underline">
          {t('budgets.backToBudgets')}
        </Link>
        <h1 className="mt-1 text-2xl font-bold text-gray-900">{budget.name}</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {t('budgets.detail.year', { year: budget.fiscal_year })} · {budget.start_date} → {budget.end_date}
        </p>
      </div>

      <div className="border-b border-gray-200">
        <nav className="-mb-px flex gap-6">
          <a href="#resumen"
            className="border-b-2 border-indigo-600 text-indigo-700 pb-2 text-sm font-semibold">
            {t('budgets.detail.tabSummary')}
          </a>
          <a href="#articulos"
            className="border-b-2 border-transparent text-gray-500 hover:text-gray-700 pb-2 text-sm font-medium">
            {t('budgets.detail.tabArticles', { count: lineItems.length })}
          </a>
        </nav>
      </div>

      <section id="resumen">
        <BudgetDetailClient
          budget={budget}
          items={items}
          categories={categories}
          canManage={canManage}
        />
      </section>

      <section id="articulos">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-900">
            {t('budgets.detail.detailedTitle')}
            <span className="ml-2 text-sm font-normal text-gray-400">
              {t('budgets.detail.detailedSubtitle', { count: lineItems.length })}
            </span>
          </h2>
        </div>
        <BudgetLineItemsClient
          budgetId={id}
          initialItems={lineItems}
          canManage={canManage}
        />
      </section>
    </div>
  );
}
