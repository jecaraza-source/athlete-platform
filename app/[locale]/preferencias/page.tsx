import Link from 'next/link';
import { requireAuthenticated } from '@/lib/rbac/server';
import { getTranslations } from 'next-intl/server';

export const dynamic = 'force-dynamic';

export default async function PreferenciasPage() {
  const user = await requireAuthenticated();
  const t = await getTranslations('preferences');

  return (
    <main className="p-8 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-800 mb-1">{t('title')}</h1>
      <p className="text-sm text-gray-500 mb-8">{t('description')}</p>

      {/* Profile summary */}
      <div className="rounded-lg border border-gray-200 p-5 mb-6 flex items-center gap-4">
        <div className="h-12 w-12 rounded-full bg-rose-100 flex items-center justify-center text-rose-700 font-bold text-lg shrink-0">
          {user.profile?.first_name?.[0]?.toUpperCase() ?? '?'}
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-gray-800">
            {user.profile
              ? `${user.profile.first_name} ${user.profile.last_name}`
              : user.authUserId}
          </p>
          <p className="text-sm text-gray-500 truncate">{user.profile?.email ?? '—'}</p>
          {user.roles.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {user.roles.map((r) => (
                <span key={r.id} className="rounded-full bg-rose-50 px-2 py-0.5 text-xs text-rose-700 font-medium">
                  {r.name ?? r.code}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Settings categories */}
      <div className="space-y-3">
        <Link
          href="/preferencias/notificaciones"
          className="flex items-center justify-between rounded-lg border border-gray-200 p-5 hover:border-rose-200 hover:bg-rose-50 transition-colors group"
        >
          <div className="flex items-center gap-4">
            <span className="text-2xl">🔔</span>
            <div>
              <p className="font-semibold text-gray-800 group-hover:text-rose-700">
                {t('notifications.title')}
              </p>
              <p className="text-sm text-gray-500">
                {t('notifications.description')}
              </p>
            </div>
          </div>
          <span className="text-gray-400 group-hover:text-rose-500">→</span>
        </Link>
      </div>
    </main>
  );
}
