import Link from 'next/link';
import { requireAuthenticated } from '@/lib/rbac/server';
import { supabaseAdmin }        from '@/lib/supabase-admin';
import { getTranslations }      from 'next-intl/server';
import { AvatarUploader }       from '@/components/avatar/avatar-uploader';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// Type for app_deployments row
// ---------------------------------------------------------------------------
type Deployment = {
  id:          number;
  deployed_at: string;
  environment: string;
  git_sha:     string | null;
  git_branch:  string | null;
  git_message: string | null;
  vercel_url:  string | null;
};

export default async function PreferenciasPage() {
  const user = await requireAuthenticated();
  const t = await getTranslations('preferences');

  // Fetch the latest deployment record for the version badge
  const { data: latestDeployment } = await supabaseAdmin
    .from('app_deployments')
    .select('id, deployed_at, environment, git_sha, git_branch, git_message, vercel_url')
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle() as { data: Deployment | null };

  return (
    <main className="p-8 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-800 mb-1">{t('title')}</h1>
      <p className="text-sm text-gray-500 mb-8">{t('description')}</p>

      {/* Profile summary + avatar upload */}
      <div className="rounded-lg border border-gray-200 p-5 mb-6">
        {/* Avatar section */}
        <div className="mb-5 pb-5 border-b border-gray-100">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            {t('avatar.title')}
          </p>
          <AvatarUploader
            currentUrl={user.profile?.avatar_url}
            initials={
              [
                user.profile?.first_name?.[0] ?? '',
                user.profile?.last_name?.[0]  ?? '',
              ].join('').toUpperCase() || '?'
            }
            size="md"
          />
        </div>

        {/* Identity info */}
        <div className="flex items-center gap-4">
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

      {/* ── System / Version info ────────────────────────────────────────── */}
      <SystemVersionCard deployment={latestDeployment} t={t} />
    </main>
  );
}

// ---------------------------------------------------------------------------
// SystemVersionCard — shows the latest Vercel deployment info
// ---------------------------------------------------------------------------

const ENV_COLORS: Record<string, string> = {
  production:  'bg-green-100  text-green-800  border-green-200',
  preview:     'bg-blue-100   text-blue-800   border-blue-200',
  development: 'bg-gray-100   text-gray-600   border-gray-200',
};

function SystemVersionCard({
  deployment,
  t,
}: {
  deployment: Deployment | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: any;
}) {
  const envLabel: Record<string, string> = {
    production:  t('system.envProduction'),
    preview:     t('system.envPreview'),
    development: t('system.envDevelopment'),
  };

  return (
    <section className="mt-8">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
        {t('system.title')}
      </p>

      <div className="rounded-lg border border-gray-200 p-5">
        {deployment ? (
          <>
            {/* Version number — large badge */}
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center gap-2">
                <span className="text-2xl font-black text-gray-800 tabular-nums">
                  v{deployment.id}
                </span>
                {/* Environment badge */}
                <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                  ENV_COLORS[deployment.environment] ?? ENV_COLORS.development
                }`}>
                  {envLabel[deployment.environment] ?? deployment.environment}
                </span>
              </div>
            </div>

            {/* Metadata grid */}
            <dl className="grid grid-cols-1 gap-y-2 sm:grid-cols-2 sm:gap-x-6">
              {/* Published date */}
              <div>
                <dt className="text-xs text-gray-400">{t('system.deployedAt')}</dt>
                <dd className="text-sm font-medium text-gray-700 mt-0.5">
                  {new Date(deployment.deployed_at).toLocaleString('es-MX', {
                    day:    'numeric',
                    month:  'short',
                    year:   'numeric',
                    hour:   '2-digit',
                    minute: '2-digit',
                    timeZoneName: 'short',
                  })}
                </dd>
              </div>

              {/* Commit */}
              {deployment.git_sha && (
                <div>
                  <dt className="text-xs text-gray-400">{t('system.commit')}</dt>
                  <dd className="mt-0.5">
                    {deployment.vercel_url ? (
                      <a
                        href={deployment.vercel_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded bg-gray-100 px-2 py-0.5 font-mono text-xs text-gray-700 hover:bg-gray-200 transition-colors"
                      >
                        {deployment.git_sha}
                        <svg className="w-3 h-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                    ) : (
                      <code className="rounded bg-gray-100 px-2 py-0.5 font-mono text-xs text-gray-700">
                        {deployment.git_sha}
                      </code>
                    )}
                  </dd>
                </div>
              )}

              {/* Branch */}
              {deployment.git_branch && (
                <div>
                  <dt className="text-xs text-gray-400">{t('system.branch')}</dt>
                  <dd className="text-sm font-medium text-gray-700 mt-0.5 font-mono">
                    {deployment.git_branch}
                  </dd>
                </div>
              )}

              {/* Commit message */}
              {deployment.git_message && (
                <div className="sm:col-span-2">
                  <dt className="text-xs text-gray-400">Descripción</dt>
                  <dd className="mt-0.5 text-sm text-gray-600 italic truncate max-w-sm">
                    {deployment.git_message}
                  </dd>
                </div>
              )}
            </dl>
          </>
        ) : (
          /* No deployment record — local dev or first deploy */
          <div className="flex items-center gap-3 text-sm text-gray-400">
            <span className="text-xl">🔧</span>
            <span>{t('system.noDeployment')}</span>
          </div>
        )}
      </div>
    </section>
  );
}
