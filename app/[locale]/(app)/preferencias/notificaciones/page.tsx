import Link from 'next/link';
import { requireAuthenticated } from '@/lib/rbac/server';
import { supabaseAdmin }         from '@/lib/supabase-admin';
import BackButton from '@/components/back-button';
import NotificationPreferencesForm from './notification-preferences-form';

export const dynamic = 'force-dynamic';

const PRIVACY_SECTIONS = [
  {
    heading: '1. Responsable del Tratamiento de Datos',
    body: `AO Deportes ("nosotros", "la plataforma") es responsable del tratamiento de los datos personales que usted nos proporciona a través de la aplicación móvil AO Deportes y del sitio web aodeporte.com.`,
  },
  {
    heading: '2. Datos Personales que Recopilamos',
    body: `Podemos recopilar y tratar las siguientes categorías de datos personales:\n\n• Datos de identificación: nombre completo, correo electrónico, número de teléfono.\n• Datos deportivos: disciplina, categoría, resultados y métricas de rendimiento.\n• Datos de salud: información médica, nutricional, fisioterapéutica y psicológica registrada por el staff especializado.\n• Datos de uso: interacciones dentro de la plataforma, registros de acceso y preferencias.\n• Fotografías y archivos multimedia: imágenes de perfil y documentos adjuntos cargados en la plataforma.`,
  },
  {
    heading: '3. Finalidades del Tratamiento',
    body: `Sus datos personales se utilizan para:\n\n• Gestionar su registro y cuenta dentro de la plataforma.\n• Proveer seguimiento integral del desarrollo deportivo, médico, nutricional y psicológico del atleta.\n• Facilitar la comunicación entre atletas, entrenadores y staff especializado.\n• Generar reportes e indicadores de desempeño.\n• Enviar notificaciones relevantes relacionadas con su plan de entrenamiento y actividades.\n• Cumplir con obligaciones legales aplicables.`,
  },
  {
    heading: '4. Fundamento Legal',
    body: `El tratamiento de sus datos se basa en:\n\n• Su consentimiento explícito al registrarse en la plataforma.\n• La ejecución de la relación contractual/deportiva entre el atleta y la organización.\n• El cumplimiento de obligaciones legales.\n• Nuestros intereses legítimos en la mejora y operación de la plataforma.`,
  },
  {
    heading: '5. Conservación de los Datos',
    body: `Sus datos personales se conservarán durante el tiempo que mantenga una cuenta activa en la plataforma, y por el período adicional que resulte necesario para cumplir con obligaciones legales o resolver disputas. Los datos de salud se conservan conforme a los plazos establecidos por la normativa sanitaria aplicable.`,
  },
  {
    heading: '6. Compartición de Datos',
    body: `No vendemos ni cedemos sus datos personales a terceros con fines comerciales. Podemos compartir sus datos con:\n\n• Personal autorizado de la plataforma (entrenadores, médicos, nutriólogos y demás staff registrado).\n• Proveedores de tecnología que nos apoyan en la operación del servicio (Supabase para almacenamiento y autenticación, Vercel para hospedaje), sujetos a acuerdos de confidencialidad.\n• Autoridades competentes cuando sea requerido por ley.`,
  },
  {
    heading: '7. Seguridad de los Datos',
    body: `Implementamos medidas técnicas y organizativas adecuadas para proteger sus datos personales contra acceso no autorizado, pérdida, destrucción o alteración. Esto incluye cifrado en tránsito (TLS), control de acceso basado en roles y autenticación segura.`,
  },
  {
    heading: '8. Sus Derechos',
    body: `De acuerdo con la legislación aplicable, usted tiene derecho a:\n\n• Acceder a sus datos personales.\n• Rectificar datos inexactos o incompletos.\n• Solicitar la supresión de sus datos (derecho al olvido).\n• Oponerse al tratamiento de sus datos.\n• Solicitar la portabilidad de sus datos.\n• Retirar su consentimiento en cualquier momento.\n\nPara ejercer estos derechos, contacte a: privacidad@aodeporte.com`,
  },
  {
    heading: '9. Datos de Menores',
    body: `La plataforma puede ser utilizada por atletas menores de edad bajo supervisión y con el consentimiento expreso de sus padres o tutores legales. Si usted es padre o tutor y tiene alguna inquietud sobre el tratamiento de datos de un menor, contáctenos de inmediato.`,
  },
  {
    heading: '10. Cambios a este Aviso',
    body: `Podemos actualizar este Aviso de Privacidad periódicamente. Le notificaremos sobre cambios significativos mediante un aviso visible en la aplicación o por correo electrónico. Le recomendamos revisar este aviso con regularidad.`,
  },
  {
    heading: '11. Contacto',
    body: `Si tiene preguntas o inquietudes sobre el tratamiento de sus datos personales, puede contactarnos en:\n\nAO Deportes\nCorreo: privacidad@aodeporte.com\nSitio web: aodeporte.com`,
  },
];

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

      {/* ── Aviso de Privacidad ─────────────────────────────────────── */}
      <section className="mt-10">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Aviso de Privacidad
        </h2>

        <details className="group rounded-xl border border-indigo-100 bg-indigo-50/40 overflow-hidden">
          {/* Banner — click para expandir/colapsar */}
          <summary className="flex items-center gap-3 px-5 py-4 bg-indigo-50 cursor-pointer list-none hover:bg-indigo-100/60 transition-colors">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-100">
              <svg className="w-4 h-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.955 11.955 0 003 9.749c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-indigo-800">Aviso de Privacidad — AO Deportes</p>
              {user.profile?.privacy_consent_accepted_at ? (
                <p className="text-xs text-indigo-500 mt-0.5">
                  Aceptado el{' '}
                  {new Date(user.profile.privacy_consent_accepted_at).toLocaleDateString('es-MX', {
                    day: 'numeric', month: 'long', year: 'numeric',
                  })}
                </p>
              ) : (
                <p className="text-xs text-amber-600 mt-0.5">Aún no has aceptado el aviso de privacidad.</p>
              )}
            </div>
            <span className="shrink-0 text-xs text-indigo-400 mr-2">Última actualización: abril 2026</span>
            {/* Chevron que rota al abrir */}
            <svg className="w-4 h-4 text-indigo-400 shrink-0 transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </summary>

          {/* Contenido del aviso — visible solo al abrir */}
          <div className="px-5 py-5 space-y-5 max-h-[480px] overflow-y-auto border-t border-indigo-100">
            {PRIVACY_SECTIONS.map((section) => (
              <div key={section.heading}>
                <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-1">
                  {section.heading}
                </h3>
                <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-line">
                  {section.body}
                </p>
              </div>
            ))}
          </div>
        </details>
      </section>
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
