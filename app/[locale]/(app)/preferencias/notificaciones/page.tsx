import Link from 'next/link';
import { requireAuthenticated } from '@/lib/rbac/server';
import { supabaseAdmin }         from '@/lib/supabase-admin';
import BackButton from '@/components/back-button';
import NotificationPreferencesForm from './notification-preferences-form';

export const dynamic = 'force-dynamic';

const PLATFORM_LABELS: Record<string, string> = {
  ios:     'iOS',
  android: 'Android',
  web:     'Web',
};

export default async function NotificationPreferencesPage() {
  const user = await requireAuthenticated();
  if (!user.profile) return null;

  const profileId = user.profile.id;

  const [
    { data: prefs },
    { data: devices },
    { data: auditLog },
    { data: recentEmails },
  ] = await Promise.all([
    // Channel preferences
    supabaseAdmin
      .from('notification_preferences')
      .select('channel, enabled, is_mandatory, updated_at')
      .eq('profile_id', profileId),

    // Registered push devices
    supabaseAdmin
      .from('push_device_tokens')
      .select('id, platform, device_name, is_active, last_seen_at, registered_at')
      .eq('profile_id', profileId)
      .order('registered_at', { ascending: false }),

    // Preference change history
    supabaseAdmin
      .from('notification_audit_log')
      .select('id, action, metadata, created_at')
      .eq('action', 'preference_updated')
      .eq('entity_id', profileId)
      .order('created_at', { ascending: false })
      .limit(5),

    // Recent emails received
    supabaseAdmin
      .from('email_jobs')
      .select('id, subject, status, scheduled_at, processed_at, campaign_id')
      .eq('recipient_profile_id', profileId)
      .order('created_at', { ascending: false })
      .limit(5),
  ]);

  const emailPref = prefs?.find((p) => p.channel === 'email');
  const pushPref  = prefs?.find((p) => p.channel === 'push');

  const preferences = {
    email: {
      enabled:      emailPref?.enabled      ?? true,
      is_mandatory: emailPref?.is_mandatory ?? false,
      updated_at:   emailPref?.updated_at   ?? null,
    },
    push: {
      enabled:      pushPref?.enabled      ?? true,
      is_mandatory: pushPref?.is_mandatory ?? false,
      updated_at:   pushPref?.updated_at   ?? null,
    },
  };

  const activeDevices   = (devices ?? []).filter((d) => d.is_active);
  const inactiveDevices = (devices ?? []).filter((d) => !d.is_active);

  return (
    <main className="p-8 max-w-2xl">
      <BackButton href="/preferencias" label="Volver a Preferencias" />

      <h1 className="text-2xl font-bold text-rose-700 mt-4 mb-1">Notificaciones</h1>
      <p className="text-sm text-gray-500 mb-8">
        Elige qué canales quieres recibir. Los canales obligatorios no se pueden desactivar.
      </p>

      {/* ── Channel toggles ─────────────────────────────────────────── */}
      <section className="mb-8">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Canales
        </h2>
        <NotificationPreferencesForm
          profileId={profileId}
          preferences={preferences}
        />
      </section>

      {/* ── Registered devices ──────────────────────────────────────── */}
      <section className="mb-8">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Dispositivos registrados
        </h2>

        {(devices ?? []).length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-200 p-6 text-center text-sm text-gray-400">
            <p>No hay dispositivos registrados.</p>
            <p className="mt-1 text-xs">
              Los dispositivos se registran automáticamente al iniciar sesión en la app móvil.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {activeDevices.map((d) => (
              <DeviceRow key={d.id} device={d} platformLabel={PLATFORM_LABELS[d.platform] ?? d.platform} />
            ))}
            {inactiveDevices.length > 0 && (
              <details className="mt-2">
                <summary className="cursor-pointer text-xs text-gray-400 hover:text-gray-600">
                  {inactiveDevices.length} dispositivo{inactiveDevices.length !== 1 ? 's' : ''} inactivo{inactiveDevices.length !== 1 ? 's' : ''}
                </summary>
                <div className="mt-2 space-y-2 opacity-60">
                  {inactiveDevices.map((d) => (
                    <DeviceRow key={d.id} device={d} platformLabel={PLATFORM_LABELS[d.platform] ?? d.platform} />
                  ))}
                </div>
              </details>
            )}
          </div>
        )}
      </section>

      {/* ── Recent emails received ──────────────────────────────────── */}
      {(recentEmails ?? []).length > 0 && (
        <section className="mb-8">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Correos recientes recibidos
          </h2>
          <div className="rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  <th className="px-4 py-2 text-left">Asunto</th>
                  <th className="px-4 py-2 text-left">Estado</th>
                  <th className="px-4 py-2 text-left">Fecha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(recentEmails ?? []).map((job) => (
                  <tr key={job.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-gray-700 max-w-xs truncate">{job.subject}</td>
                    <td className="px-4 py-2">
                      <StatusBadge status={job.status} />
                    </td>
                    <td className="px-4 py-2 text-gray-400">
                      {new Date(job.scheduled_at).toLocaleDateString('es-MX', {
                        month: 'short', day: 'numeric', year: 'numeric',
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ── Preference change history ────────────────────────────────── */}
      {(auditLog ?? []).length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Historial de cambios
          </h2>
          <ul className="space-y-2">
            {(auditLog ?? []).map((entry) => {
              const meta = (entry.metadata ?? {}) as Record<string, unknown>;
              return (
                <li key={entry.id} className="flex items-start justify-between text-xs text-gray-600 border-l-2 border-gray-200 pl-3">
                  <span>
                    Email:{' '}
                    <span className={meta.email_enabled ? 'text-green-700 font-medium' : 'text-gray-400'}>
                      {meta.email_enabled ? 'activado' : 'desactivado'}
                    </span>
                    {' · '}
                    Push:{' '}
                    <span className={meta.push_enabled ? 'text-green-700 font-medium' : 'text-gray-400'}>
                      {meta.push_enabled ? 'activado' : 'desactivado'}
                    </span>
                  </span>
                  <span className="text-gray-400 shrink-0 ml-4">
                    {new Date(entry.created_at).toLocaleString('es-MX', {
                      month: 'short', day: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </main>
  );
}

// ---------------------------------------------------------------------------
// Sub-components (server-renderable, no client state needed)
// ---------------------------------------------------------------------------

function DeviceRow({
  device,
  platformLabel,
}: {
  device: {
    id: string;
    platform: string;
    device_name: string | null;
    is_active: boolean;
    last_seen_at: string | null;
    registered_at: string;
  };
  platformLabel: string;
}) {
  const platformIcons: Record<string, string> = {
    iOS: '🍎', Android: '🤖', Web: '🌐',
  };
  return (
    <div className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3 text-sm">
      <div className="flex items-center gap-3">
        <span className="text-lg">{platformIcons[platformLabel] ?? '📱'}</span>
        <div>
          <p className="font-medium text-gray-700">
            {device.device_name ?? platformLabel}
          </p>
          <p className="text-xs text-gray-400">
            {platformLabel} · Registrado{' '}
            {new Date(device.registered_at).toLocaleDateString('es-MX', {
              month: 'short', day: 'numeric', year: 'numeric',
            })}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {device.last_seen_at && (
          <span className="text-xs text-gray-400">
            Última vez{' '}
            {new Date(device.last_seen_at).toLocaleDateString('es-MX', {
              month: 'short', day: 'numeric',
            })}
          </span>
        )}
        <span className={`inline-block h-2 w-2 rounded-full ${
          device.is_active ? 'bg-green-500' : 'bg-gray-300'
        }`} />
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    sent:       'bg-green-100 text-green-700',
    delivered:  'bg-green-100 text-green-700',
    failed:     'bg-red-100   text-red-600',
    pending:    'bg-yellow-100 text-yellow-700',
    bounced:    'bg-orange-100 text-orange-700',
    opened:     'bg-blue-100  text-blue-700',
    clicked:    'bg-blue-100  text-blue-700',
  };
  const labels: Record<string, string> = {
    sent: 'Enviado', delivered: 'Entregado', failed: 'Fallido',
    pending: 'Pendiente', bounced: 'Rebotado', opened: 'Abierto', clicked: 'Clic',
  };
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
      styles[status] ?? 'bg-gray-100 text-gray-500'
    }`}>
      {labels[status] ?? status}
    </span>
  );
}
