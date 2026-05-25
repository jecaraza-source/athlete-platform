'use client';

import { useRef, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { createSupplier, updateSupplier } from '@/lib/finance/actions';
import type { FinanceSupplier } from '@/lib/types/finance';

const DISCIPLINAS_PROVEEDOR = [
  'TIRO', 'CANOTAJE', 'BÁDMINTON', 'JUDO', 'KARATE', 'TKD',
  'GIMNASIA', 'BREAKING', 'ATLETISMO', 'NATACIÓN', 'BOX',
  'NUTRICIÓN / SUPLEMENTOS',
  'TRANSPORTE TERRESTRE', 'TRANSPORTE AÉREO',
  'HOSPEDAJE', 'VIÁTICOS',
  'EQUIPAMIENTO GENERAL', 'UNIFORMES / INDUMENTARIA',
  'SERVICIOS MÉDICOS', 'PSICOLOGÍA', 'FISIOTERAPIA',
  'ADMINISTRACIÓN / PAPELERÍA',
  'TECNOLOGÍA / SOFTWARE',
  'VARIOS / GENERAL',
  'Otro / Personalizado',
];
const DISC_OTRO = 'Otro / Personalizado';

export function SupplierForm({
  supplier,
  onSuccess,
  onCancel,
}: {
  supplier?: FinanceSupplier;
  onSuccess?: () => void;
  onCancel?: () => void;
}) {
  const t = useTranslations('finances.suppliers.form');
  const tApproval = useTranslations('finances.approval');
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [discSelect, setDiscSelect] = useState(
    supplier?.disciplina && !DISCIPLINAS_PROVEEDOR.includes(supplier.disciplina)
      ? DISC_OTRO
      : (supplier?.disciplina ?? '')
  );
  const [discCustom, setDiscCustom] = useState(
    supplier?.disciplina && !DISCIPLINAS_PROVEEDOR.includes(supplier.disciplina)
      ? supplier.disciplina
      : ''
  );
  const discValue = discSelect === DISC_OTRO ? discCustom : discSelect;
  const isEditing = !!supplier;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = isEditing
        ? await updateSupplier(supplier.id, formData)
        : await createSupplier(formData);
      if (result.error) {
        setError(result.error);
      } else {
        formRef.current?.reset();
        onSuccess?.();
      }
    });
  }

  const inputClass = 'w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500';

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {t('nameLabel')} <span className="text-red-500">*</span>
        </label>
        <input name="name" type="text" required defaultValue={supplier?.name}
          className={inputClass} placeholder={t('namePlaceholder')} />
      </div>

      <input type="hidden" name="disciplina" value={discValue} />
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {t('disciplineLabel')}
          <span className="ml-1 text-gray-400 font-normal text-xs">{t('disciplineOptional')}</span>
        </label>
        <select value={discSelect} onChange={e => setDiscSelect(e.target.value)} className={inputClass}>
          <option value="">{t('noSpecified')}</option>
          {DISCIPLINAS_PROVEEDOR.map(d => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
        {discSelect === DISC_OTRO && (
          <input type="text" value={discCustom} onChange={e => setDiscCustom(e.target.value)}
            className={`${inputClass} mt-1.5`} placeholder={t('customPlaceholder')} autoFocus />
        )}
        <p className="text-xs text-gray-400 mt-1">{t('disciplineHint')}</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('rfcLabel')}</label>
          <input name="rfc" type="text" defaultValue={supplier?.rfc ?? ''}
            onChange={e => { e.target.value = e.target.value.toUpperCase(); }}
            className={`${inputClass} uppercase`} placeholder="XAXX010101000"
            style={{ textTransform: 'uppercase' }} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('phoneLabel')}</label>
          <input name="phone" type="tel" defaultValue={supplier?.phone ?? ''}
            className={inputClass} placeholder="+52 55 0000 0000" />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('emailLabel')}</label>
        <input name="email" type="email" defaultValue={supplier?.email ?? ''}
          className={inputClass} placeholder="contacto@proveedor.com" />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('addressLabel')}</label>
        <textarea name="address" rows={2} defaultValue={supplier?.address ?? ''}
          className={inputClass} placeholder={t('addressPlaceholder')} />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('notesLabel')}</label>
        <textarea name="notes" rows={2} defaultValue={supplier?.notes ?? ''} className={inputClass} />
      </div>

      <div className="flex justify-end gap-3 pt-2">
        {onCancel && (
          <button type="button" onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">
            {tApproval('cancel')}
          </button>
        )}
        <button type="submit" disabled={isPending}
          className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50">
          {isPending ? t('saving') : isEditing ? t('edit') : t('create')}
        </button>
      </div>
    </form>
  );
}
