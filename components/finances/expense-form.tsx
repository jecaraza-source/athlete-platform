'use client';

import { useRef, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { createExpense, updateExpense, submitExpense } from '@/lib/finance/actions';
import type {
  FinanceExpense,
  FinanceExpenseCategory,
  FinanceSupplier,
  FinanceBudgetItem,
} from '@/lib/types/finance';

type Athlete = { id: string; first_name: string; last_name: string };

const DISCIPLINAS = [
  'TIRO', 'CANOTAJE', 'BÁDMINTON', 'JUDO', 'KARATE', 'TKD',
  'GIMNASIA', 'BREAKING', 'ATLETISMO', 'NATACIÓN', 'BOX', 'NUTRICIÓN',
  'León, Gto.', 'Monterrey, N.L.', 'Puebla, Pue.', 'Progreso, Yuc.',
  'Acapulco, Gro.', 'Guadalajara, Jal.', 'Tlaxcala, Tlax.', 'CDMX',
  'Tijuana, B.C.', 'Mérida, Yuc.', 'Veracruz, Ver.',
  'Otro / Personalizado',
];

const ES_OTRO = 'Otro / Personalizado';

export function ExpenseForm({
  expense,
  categories,
  suppliers,
  budgetItems,
  athletes,
  onSuccess,
  onCancel,
}: {
  expense?: FinanceExpense;
  categories: FinanceExpenseCategory[];
  suppliers: FinanceSupplier[];
  budgetItems?: FinanceBudgetItem[];
  athletes?: Athlete[];
  onSuccess?: () => void;
  onCancel?: () => void;
}) {
  const t = useTranslations('finances.expenses.form');
  const tApproval = useTranslations('finances.approval');
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [sendForReview, setSendForReview] = useState(false);
  const [disciplinaSelect, setDisciplinaSelect] = useState(
    expense?.disciplina && !DISCIPLINAS.includes(expense.disciplina) ? ES_OTRO : (expense?.disciplina ?? '')
  );
  const [disciplinaCustom, setDisciplinaCustom] = useState(
    expense?.disciplina && !DISCIPLINAS.includes(expense.disciplina) ? expense.disciplina : ''
  );
  const isEditing = !!expense;
  const disciplinaValue = disciplinaSelect === ES_OTRO ? disciplinaCustom : disciplinaSelect;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    const formData = new FormData(e.currentTarget);
    const doSubmit = sendForReview && !isEditing;

    startTransition(async () => {
      if (isEditing) {
        const result = await updateExpense(expense.id, formData);
        if (result.error) { setError(result.error); return; }
      } else {
        const result = await createExpense(formData);
        if (result.error) { setError(result.error); return; }

        if (doSubmit && result.id) {
          const submitResult = await submitExpense(result.id);
          if (submitResult.error) {
            setSuccessMsg(t('createdPartialError', { error: submitResult.error }));
          } else {
            setSuccessMsg(t('createdAndSent'));
          }
        }
      }

      formRef.current?.reset();
      setSendForReview(false);
      onSuccess?.();
    });
  }

  const today = new Date().toISOString().split('T')[0];
  const inputClass = 'w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500';

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>
      )}
      {successMsg && (
        <div className="rounded-md bg-green-50 border border-green-200 p-3 text-sm text-green-700">{successMsg}</div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {t('titleLabel')} <span className="text-red-500">*</span>
        </label>
        <input name="title" type="text" required defaultValue={expense?.title}
          className={inputClass} placeholder={t('titlePlaceholder')} />
      </div>

      <input type="hidden" name="disciplina" value={disciplinaValue} />
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('expenseTypeLabel')} <span className="text-red-500">*</span>
          </label>
          <select name="category_id" required defaultValue={expense?.category_id ?? ''} className={inputClass}>
            <option value="">{t('selectCategory')}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('disciplineLabel')}</label>
          <select value={disciplinaSelect} onChange={e => setDisciplinaSelect(e.target.value)} className={inputClass}>
            <option value="">{t('noSpecified')}</option>
            {DISCIPLINAS.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
          {disciplinaSelect === ES_OTRO && (
            <input type="text" value={disciplinaCustom} onChange={e => setDisciplinaCustom(e.target.value)}
              className={`${inputClass} mt-1.5`} placeholder={t('customPlaceholder')} autoFocus />
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('amountLabel')} <span className="text-red-500">*</span>
          </label>
          <input name="amount" type="number" required min={0.01} step="0.01"
            defaultValue={expense?.amount} className={inputClass} placeholder="0.00" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('expenseDateLabel')} <span className="text-red-500">*</span>
          </label>
          <input name="expense_date" type="date" required
            defaultValue={expense?.expense_date ?? today} className={inputClass} />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('invoiceLabel')}</label>
        <input name="invoice_number" type="text" defaultValue={expense?.invoice_number ?? ''}
          className={inputClass} placeholder="FAC-0001" />
      </div>

      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('linkedWith')}</p>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('supplierLabel')}</label>
          <select name="supplier_id" defaultValue={expense?.supplier_id ?? ''} className={inputClass}>
            <option value="">{t('noSupplier')}</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>{s.name}{s.rfc ? ` — RFC: ${s.rfc}` : ''}</option>
            ))}
          </select>
          {suppliers.length === 0 && (
            <p className="text-xs text-gray-400 mt-1">
              {t('noSupplierHint')}{' '}
              <a href="/finances/suppliers" className="text-indigo-600 hover:underline">{t('addSupplierLink')}</a>
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('athleteLabel')}{' '}
            <span className="text-gray-400 font-normal text-xs">{t('athleteHint')}</span>
          </label>
          <select name="athlete_id" defaultValue={expense?.athlete_id ?? ''} className={inputClass}>
            <option value="">{t('noAthlete')}</option>
            {(athletes ?? []).map((a) => (
              <option key={a.id} value={a.id}>{a.first_name} {a.last_name}</option>
            ))}
          </select>
        </div>

        {budgetItems && budgetItems.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('budgetItemLabel')}</label>
            <select name="budget_item_id" defaultValue={expense?.budget_item_id ?? ''} className={inputClass}>
              <option value="">{t('noBudgetItem')}</option>
              {budgetItems.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('descLabel')}</label>
          <textarea name="description" rows={2} defaultValue={expense?.description ?? ''}
            className={inputClass} placeholder={t('descPlaceholder')} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('notesLabel')}</label>
          <textarea name="notes" rows={2} defaultValue={expense?.notes ?? ''}
            className={inputClass} placeholder={t('notesPlaceholder')} />
        </div>
      </div>

      {!isEditing && (
        <div
          className={`rounded-lg border-2 p-4 transition-colors cursor-pointer ${
            sendForReview ? 'border-amber-400 bg-amber-50' : 'border-gray-200 bg-white hover:border-gray-300'
          }`}
          onClick={() => setSendForReview(v => !v)}
        >
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={sendForReview}
              onChange={e => { e.stopPropagation(); setSendForReview(e.target.checked); }}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-amber-500 focus:ring-amber-400"
            />
            <div>
              <span className="text-sm font-semibold text-gray-800">{t('sendForReviewLabel')}</span>
              <p className="text-xs text-gray-500 mt-0.5">{t('sendForReviewHint')}</p>
            </div>
          </label>
        </div>
      )}

      <div className="flex justify-end gap-3 pt-1">
        {onCancel && (
          <button type="button" onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">
            {t('cancel')}
          </button>
        )}
        <button type="submit" disabled={isPending}
          className={`px-4 py-2 text-sm font-medium text-white rounded-md disabled:opacity-50 ${
            sendForReview && !isEditing ? 'bg-amber-500 hover:bg-amber-600' : 'bg-indigo-600 hover:bg-indigo-700'
          }`}>
          {isPending
            ? t('saving')
            : isEditing
              ? t('edit')
              : sendForReview
                ? t('createAndSend')
                : t('create')
          }
        </button>
      </div>
    </form>
  );
}
