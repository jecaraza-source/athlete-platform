'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ExpenseForm } from '@/components/finances/expense-form';
import { CategoryForm } from '@/components/finances/category-form';
import type {
  FinanceExpenseCategory,
  FinanceSupplier,
  FinanceBudgetItem,
} from '@/lib/types/finance';

type Athlete = { id: string; first_name: string; last_name: string };

type Props = {
  initialCategories: FinanceExpenseCategory[];
  suppliers: FinanceSupplier[];
  budgetItems?: FinanceBudgetItem[];
  athletes?: Athlete[];
};

export function ExpensesClient({
  initialCategories,
  suppliers,
  budgetItems,
  athletes,
}: Props) {
  const t = useTranslations('finances.expenses');
  const [categories, setCategories] = useState(initialCategories);
  const [activeTab, setActiveTab] = useState<'expense' | 'category'>('expense');
  const [open, setOpen] = useState(false);

  function handleCategoryCreated(newCat: FinanceExpenseCategory) {
    setCategories((prev) => [...prev, newCat].sort((a, b) => a.name.localeCompare(b.name)));
    setActiveTab('expense');
  }

  return (
    <div className="rounded-lg border border-indigo-200 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-3 bg-indigo-50 text-sm font-semibold text-indigo-700 select-none hover:bg-indigo-100 transition-colors"
      >
        <span>{t('newExpense')}</span>
        <svg
          className={`h-4 w-4 transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {open && (
        <div className="bg-white border-t border-indigo-100">
          <div className="flex border-b border-gray-200 px-5 pt-4 gap-4">
            <button
              type="button"
              onClick={() => setActiveTab('expense')}
              className={`pb-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'expense'
                  ? 'border-indigo-600 text-indigo-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t('tabExpense')}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('category')}
              className={`pb-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'category'
                  ? 'border-indigo-600 text-indigo-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t('tabNewCategory')}
            </button>
          </div>

          <div className="p-5">
            {activeTab === 'expense' ? (
              <>
                {categories.length === 0 && (
                  <div className="mb-4 rounded-md bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
                    {t('noCategoryWarning')}{' '}
                    <button
                      type="button"
                      onClick={() => setActiveTab('category')}
                      className="underline font-medium hover:text-amber-900"
                    >
                      {t('noCategoryCreate')}
                    </button>
                  </div>
                )}
                <ExpenseForm
                  categories={categories}
                  suppliers={suppliers}
                  budgetItems={budgetItems}
                  athletes={athletes}
                  onSuccess={() => setOpen(false)}
                  onCancel={() => setOpen(false)}
                />
              </>
            ) : (
              <CategoryForm
                onSuccess={handleCategoryCreated}
                onCancel={() => setActiveTab('expense')}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
