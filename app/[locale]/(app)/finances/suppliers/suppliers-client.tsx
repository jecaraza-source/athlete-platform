'use client';

import { useMemo, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import {
  deactivateSupplier, deleteSupplier,
  listSupplierAttachments, uploadSupplierAttachment,
  deleteSupplierAttachment, getSupplierAttachmentSignedUrl,
} from '@/lib/finance/actions';
import { SupplierForm } from '@/components/finances/supplier-form';
import { InlineAttachments } from '@/components/finances/inline-attachments';
import type { FinanceSupplier } from '@/lib/types/finance';

function SupplierCard({
  supplier, canManage,
}: { supplier: FinanceSupplier; canManage: boolean }) {
  const t = useTranslations('finances.suppliers');
  const tApproval = useTranslations('finances.approval');
  const [mode, setMode] = useState<'view' | 'edit'>('view');
  const [showDocs, setShowDocs] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleDeactivate() {
    if (!confirm(t('deactivateConfirm', { name: supplier.name }))) return;
    startTransition(async () => {
      const res = await deactivateSupplier(supplier.id);
      if (res.error) setError(res.error);
    });
  }

  function handleDelete() {
    if (!confirm(t('deleteConfirm', { name: supplier.name }))) return;
    startTransition(async () => {
      const res = await deleteSupplier(supplier.id);
      if (res.error) setError(res.error);
    });
  }

  if (mode === 'edit') {
    return (
      <div className="rounded-lg border border-indigo-200 bg-white p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-indigo-800">{t('editingTitle', { name: supplier.name })}</p>
          <button type="button" onClick={() => setMode('view')}
            className="text-xs text-gray-500 hover:text-gray-700">{t('cancelEdit')}</button>
        </div>
        <SupplierForm supplier={supplier} onSuccess={() => setMode('view')} onCancel={() => setMode('view')} />
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3 hover:border-gray-300 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-gray-900">{supplier.name}</p>
          {supplier.disciplina && (
            <span className="inline-flex mt-0.5 px-2 py-0.5 text-xs font-medium bg-indigo-100 text-indigo-700 rounded-full">
              {supplier.disciplina}
            </span>
          )}
        </div>
        {canManage && (
          <div className="flex gap-1 shrink-0 flex-wrap">
            <button onClick={() => setMode('edit')}
              className="px-2.5 py-1 text-xs font-medium bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200">
              {t('editBtn')}
            </button>
            <button onClick={handleDeactivate} disabled={isPending}
              title={t('deactivateTitle')}
              className="px-2.5 py-1 text-xs font-medium bg-amber-100 text-amber-700 rounded hover:bg-amber-200 disabled:opacity-50">
              {isPending ? '…' : t('deactivateBtn')}
            </button>
            <button onClick={handleDelete} disabled={isPending}
              title={t('deleteTitle')}
              className="px-2.5 py-1 text-xs font-medium bg-red-100 text-red-700 rounded hover:bg-red-200 disabled:opacity-50">
              {isPending ? '…' : '🗑'}
            </button>
          </div>
        )}
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      <div className="space-y-0.5 text-xs text-gray-500">
        {supplier.rfc   && <p>RFC: <span className="font-mono text-gray-700 uppercase">{supplier.rfc}</span></p>}
        {supplier.email && <p>✉ {supplier.email}</p>}
        {supplier.phone && <p>📞 {supplier.phone}</p>}
        {supplier.address && <p className="line-clamp-2 text-gray-400">{supplier.address}</p>}
        {supplier.notes && <p className="italic text-gray-400 line-clamp-1">{supplier.notes}</p>}
      </div>

      <div>
        <button type="button" onClick={() => setShowDocs(v => !v)}
          className="text-xs text-gray-500 hover:text-gray-700 underline">
          {showDocs ? t('hideDocuments') : t('showDocuments')}
        </button>
      </div>

      {showDocs && (
        <div className="border-t border-gray-100 pt-3 space-y-4">
          <InlineAttachments
            label={t('csfLabel')}
            color="violet"
            canManage={canManage}
            listFn={() => listSupplierAttachments(supplier.id).then(r => r.filter(a => a.attachment_type === 'csf'))}
            uploadFn={(fd) => uploadSupplierAttachment(supplier.id, 'csf', fd)}
            deleteFn={deleteSupplierAttachment}
            signedUrlFn={getSupplierAttachmentSignedUrl}
          />
          <InlineAttachments
            label={t('generalDocumentsLabel')}
            color="sky"
            canManage={canManage}
            listFn={() => listSupplierAttachments(supplier.id).then(r => r.filter(a => a.attachment_type === 'document'))}
            uploadFn={(fd) => uploadSupplierAttachment(supplier.id, 'document', fd)}
            deleteFn={deleteSupplierAttachment}
            signedUrlFn={getSupplierAttachmentSignedUrl}
          />
        </div>
      )}
    </div>
  );
}

export function SuppliersClient({
  suppliers, canManage,
}: { suppliers: FinanceSupplier[]; canManage: boolean }) {
  const t = useTranslations('finances.suppliers');
  const [filterDisc, setFilterDisc] = useState('');

  const allDiscs = useMemo(() =>
    [...new Set(suppliers.map(s => s.disciplina).filter(Boolean) as string[])].sort(),
    [suppliers]
  );

  const filtered = useMemo(() =>
    filterDisc ? suppliers.filter(s => s.disciplina === filterDisc) : suppliers,
    [suppliers, filterDisc]
  );

  if (suppliers.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-12 text-center">
        <p className="text-gray-500 text-sm">{t('noSuppliers')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {allDiscs.length > 0 && (
        <div className="flex items-center gap-3 flex-wrap">
          <label className="text-xs font-medium text-gray-500">{t('filterByType')}</label>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setFilterDisc('')}
              className={`px-3 py-1 text-xs rounded-full font-medium transition-colors ${
                !filterDisc ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {t('allTypes', { count: suppliers.length })}
            </button>
            {allDiscs.map(d => (
              <button
                key={d}
                onClick={() => setFilterDisc(d === filterDisc ? '' : d)}
                className={`px-3 py-1 text-xs rounded-full font-medium transition-colors ${
                  filterDisc === d ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {d} ({suppliers.filter(s => s.disciplina === d).length})
              </button>
            ))}
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="text-sm text-gray-400 italic">{t('noSuppliersForType')}</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {filtered.map(s => (
            <SupplierCard key={s.id} supplier={s} canManage={canManage} />
          ))}
        </div>
      )}
    </div>
  );
}
