import { requirePermission } from '@/lib/rbac/server';
import { getFinanceSummary } from '@/lib/finance/actions';
import { FinanceSummaryCards } from '@/components/finances/finance-summary-cards';
import { Link } from '@/i18n/navigation';
import { getTranslations } from 'next-intl/server';

export default async function FinancesPage() {
  await requirePermission('view_finances');
  const [summary, t] = await Promise.all([
    getFinanceSummary(),
    getTranslations('finances'),
  ]);

  const quickLinks = [
    { href: '/finances/budgets',   label: t('nav.budgets'),   color: 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100' },
    { href: '/finances/expenses',  label: t('nav.expenses'),  color: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' },
    { href: '/finances/payments',  label: t('nav.payments'),  color: 'bg-sky-50 text-sky-700 border-sky-200 hover:bg-sky-100' },
    { href: '/finances/nomina',    label: t('nav.payroll'),   color: 'bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100' },
    { href: '/finances/suppliers', label: t('nav.suppliers'), color: 'bg-teal-50 text-teal-700 border-teal-200 hover:bg-teal-100' },
    { href: '/finances/reports',   label: t('nav.reports'),   color: 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100' },
  ];

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
        <p className="mt-1 text-sm text-gray-500">{t('description')}</p>
      </div>

      <nav className="flex flex-wrap gap-2">
        {quickLinks.map((l) => (
          <Link
            key={l.href}
            href={l.href as Parameters<typeof Link>[0]['href']}
            className={`px-4 py-2 rounded-md border text-sm font-medium transition-colors ${l.color}`}
          >
            {l.label}
          </Link>
        ))}
      </nav>

      <FinanceSummaryCards summary={summary} />
    </div>
  );
}
