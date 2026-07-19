import Link from 'next/link';
import BackButton from '@/components/back-button';
import { getTranslations } from 'next-intl/server';
import { requireAdminAccess } from '@/lib/rbac/server';

export default async function AdminPage() {
  const user = await requireAdminAccess();
  const isAdmin = user.roles.some((r) => ['super_admin', 'admin'].includes(r.code));
  const t = await getTranslations('admin');
  const tc = await getTranslations('common');

  return (
    <main className="p-8">
      <BackButton href="/dashboard" label={tc('backToDashboard')} />
      <h1 className="text-3xl font-bold mt-4 text-rose-700">{t('title')}</h1>
      <p className="mt-2 text-gray-600 mb-8">{t('description')}</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Link
          href="/admin/console"
          className="rounded-lg border border-indigo-400 bg-indigo-600 p-6 hover:bg-indigo-700 transition-colors flex items-start gap-4"
        >
          <span className="text-3xl mt-0.5">📊</span>
          <div>
            <h2 className="text-lg font-semibold text-white">{t('console.title')}</h2>
            <p className="text-sm text-indigo-200 mt-1">{t('console.description')}</p>
          </div>
        </Link>

        <Link
          href="/admin/reportes"
          className="rounded-lg border border-emerald-400 bg-emerald-600 p-6 hover:bg-emerald-700 transition-colors flex items-start gap-4"
        >
          <span className="text-3xl mt-0.5">📋</span>
          <div>
            <h2 className="text-lg font-semibold text-white">{t('reportesMetas.title')}</h2>
            <p className="text-sm text-emerald-100 mt-1">{t('reportesMetas.description')}</p>
          </div>
        </Link>
        <Link
          href="/admin/staff"
          className="rounded-lg border border-indigo-200 bg-indigo-50 p-6 hover:bg-indigo-100 transition-colors flex items-start gap-4"
        >
          <span className="text-3xl mt-0.5">👤</span>
          <div>
            <h2 className="text-lg font-semibold text-indigo-800">{t('adminSetup.title')}</h2>
            <p className="text-sm text-indigo-600 mt-1">{t('adminSetup.description')}</p>
          </div>
        </Link>

        <Link
          href="/admin/athletes"
          className="rounded-lg border border-teal-200 bg-teal-50 p-6 hover:bg-teal-100 transition-colors flex items-start gap-4"
        >
          <span className="text-3xl mt-0.5">🏃</span>
          <div>
            <h2 className="text-lg font-semibold text-teal-800">{t('athletesSetup.title')}</h2>
            <p className="text-sm text-teal-600 mt-1">{t('athletesSetup.description')}</p>
          </div>
        </Link>

        <Link
          href="/admin/access-control"
          className="rounded-lg border border-violet-200 bg-violet-50 p-6 hover:bg-violet-100 transition-colors flex items-start gap-4"
        >
          <span className="text-3xl mt-0.5">🔐</span>
          <div>
            <h2 className="text-lg font-semibold text-violet-800">{t('accessControl.title')}</h2>
            <p className="text-sm text-violet-600 mt-1">{t('accessControl.description')}</p>
          </div>
        </Link>

        <Link
          href="/admin/notificaciones"
          className="rounded-lg border border-orange-200 bg-orange-50 p-6 hover:bg-orange-100 transition-colors flex items-start gap-4"
        >
          <span className="text-3xl mt-0.5">🔔</span>
          <div>
            <h2 className="text-lg font-semibold text-orange-800">{t('notifications.title')}</h2>
            <p className="text-sm text-orange-600 mt-1">{t('notifications.description')}</p>
          </div>
        </Link>

        <Link
          href="/admin/tickets"
          className="rounded-lg border border-rose-200 bg-rose-50 p-6 hover:bg-rose-100 transition-colors flex items-start gap-4"
        >
          <span className="text-3xl mt-0.5">🎫</span>
          <div>
            <h2 className="text-lg font-semibold text-rose-800">{t('tickets.title')}</h2>
            <p className="text-sm text-rose-600 mt-1">{t('tickets.description')}</p>
          </div>
        </Link>

        <Link
          href="/admin/protocols"
          className="rounded-lg border border-violet-200 bg-violet-50 p-6 hover:bg-violet-100 transition-colors flex items-start gap-4"
        >
          <span className="text-3xl mt-0.5">📎</span>
          <div>
            <h2 className="text-lg font-semibold text-violet-800">{t('protocolsAdmin.title')}</h2>
            <p className="text-sm text-violet-600 mt-1">{t('protocolsAdmin.description')}</p>
          </div>
        </Link>

        <Link
          href="/admin/disciplines"
          className="rounded-lg border border-indigo-200 bg-indigo-50 p-6 hover:bg-indigo-100 transition-colors flex items-start gap-4"
        >
          <span className="text-3xl mt-0.5">🏅</span>
          <div>
            <h2 className="text-lg font-semibold text-indigo-800">{t('disciplines.title')}</h2>
            <p className="text-sm text-indigo-600 mt-1">{t('disciplines.description')}</p>
          </div>
        </Link>

        <Link
          href="/admin/historia-grafica"
          className="rounded-lg border border-amber-200 bg-amber-50 p-6 hover:bg-amber-100 transition-colors flex items-start gap-4"
        >
          <span className="text-3xl mt-0.5">📸</span>
          <div>
            <h2 className="text-lg font-semibold text-amber-800">{t('historiaGrafica.title')}</h2>
            <p className="text-sm text-amber-600 mt-1">{t('historiaGrafica.description')}</p>
          </div>
        </Link>

        {isAdmin && (
          <Link
            href="/admin/bitacora"
            className="rounded-lg border border-rose-300 bg-rose-50 p-6 hover:bg-rose-100 transition-colors flex items-start gap-4"
          >
            <span className="text-3xl mt-0.5">📰</span>
            <div>
              <h2 className="text-lg font-semibold text-rose-800">{t('revista.title')}</h2>
              <p className="text-sm text-rose-600 mt-1">{t('revista.description')}</p>
            </div>
          </Link>
        )}
      </div>
    </main>
  );
}
