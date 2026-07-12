'use client';

import { useRef, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { createExpenseCategory } from '@/lib/finance/actions';
import type { FinanceExpenseCategory } from '@/lib/types/finance';

const PRESET_COLORS = [
  { hex: '#6366f1', label: 'Índigo' },
  { hex: '#10b981', label: 'Verde' },
  { hex: '#3b82f6', label: 'Azul' },
  { hex: '#f59e0b', label: 'Ámbar' },
  { hex: '#ec4899', label: 'Rosa' },
  { hex: '#ef4444', label: 'Rojo' },
  { hex: '#8b5cf6', label: 'Violeta' },
  { hex: '#14b8a6', label: 'Teal' },
  { hex: '#f97316', label: 'Naranja' },
  { hex: '#6b7280', label: 'Gris' },
];

export function CategoryForm({
  onSuccess,
  onCancel,
}: {
  onSuccess?: (newCategory: FinanceExpenseCategory) => void;
  onCancel?: () => void;
}) {
  const tCat = useTranslations('finances.category');
  const tCommon = useTranslations('finances.approval');
  const t = tCat;
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [selectedColor, setSelectedColor] = useState(PRESET_COLORS[0].hex);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    const formData = new FormData(e.currentTarget);
    formData.set('color', selectedColor);

    startTransition(async () => {
      const result = await createExpenseCategory(formData);
      if (result.error) {
        setError(result.error);
      } else {
        setSuccess(true);
        formRef.current?.reset();
        setSelectedColor(PRESET_COLORS[0].hex);
        if (onSuccess && result.id) {
          onSuccess({
            id: result.id,
            name: formData.get('name') as string,
            description: (formData.get('description') as string) || null,
            color: selectedColor,
            is_active: true,
            created_at: new Date().toISOString(),
          });
        }
        setTimeout(() => setSuccess(false), 2000);
      }
    });
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-md bg-green-50 border border-green-200 p-3 text-sm text-green-700">
          {t('created')}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {t('nameLabel')} <span className="text-red-500">*</span>
        </label>
        <input
          name="name"
          type="text"
          required
          maxLength={100}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder={t('namePlaceholder')}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {t('descLabel')} <span className="text-gray-400 font-normal text-xs">{t('descOptional')}</span>
        </label>
        <input
          name="description"
          type="text"
          maxLength={200}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder={t('descPlaceholder')}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {t('colorLabel')}
        </label>
        <div className="flex flex-wrap gap-2 items-center">
          {PRESET_COLORS.map((c) => (
            <button
              key={c.hex}
              type="button"
              title={c.label}
              onClick={() => setSelectedColor(c.hex)}
              className={`w-7 h-7 rounded-full border-2 transition-transform ${
                selectedColor === c.hex
                  ? 'border-gray-800 scale-110 shadow-md'
                  : 'border-transparent hover:scale-105'
              }`}
              style={{ backgroundColor: c.hex }}
            />
          ))}
          <div className="flex items-center gap-1.5 ml-1">
            <input
              type="color"
              value={selectedColor}
              onChange={(e) => setSelectedColor(e.target.value)}
              className="w-7 h-7 rounded cursor-pointer border border-gray-300"
            />
            <span className="text-xs text-gray-400 font-mono">{selectedColor}</span>
          </div>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium text-white"
            style={{ backgroundColor: selectedColor }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-white/60" />
            {t('preview')}
          </span>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-1">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            {tCommon('cancel')}
          </button>
        )}
        <button
          type="submit"
          disabled={isPending}
          className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50"
        >
          {isPending ? t('saving') : t('create')}
        </button>
      </div>
    </form>
  );
}
