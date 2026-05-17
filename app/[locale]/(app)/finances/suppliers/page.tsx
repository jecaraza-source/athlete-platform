import { requirePermission, hasPermission } from '@/lib/rbac/server';
import { listSuppliers } from '@/lib/finance/actions';
import { SupplierForm } from '@/components/finances/supplier-form';
import { SuppliersClient } from './suppliers-client';
import { Link } from '@/i18n/navigation';
import { getTranslations } from 'next-intl/server';

export default async function SuppliersPage() {
  await requirePermission('view_finances');
  const [suppliers, canManage, t] = await Promise.all([
    listSuppliers(),
    hasPermission('manage_finances'),
    getTranslations('finances'),
  ]);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <Link href="/finances" className="text-sm text-indigo-600 hover:underline">
          ← {t('title')}
        </Link>
        <h1 className="mt-1 text-2xl font-bold text-gray-900">{t('suppliers.title')}</h1>
        <p className="text-sm text-gray-500 mt-1">
          {t('suppliers.count', { count: suppliers.length })}
        </p>
      </div>

      {canManage && (
        <details className="rounded-lg border border-violet-200 bg-violet-50 overflow-hidden">
          <summary className="px-5 py-3 cursor-pointer text-sm font-semibold text-violet-700 select-none">
            {t('suppliers.newSupplier')}
          </summary>
          <div className="p-5 bg-white border-t border-violet-100">
            <SupplierForm />
          </div>
        </details>
      )}

      <SuppliersClient suppliers={suppliers} canManage={canManage} />
    </div>
  );
}
