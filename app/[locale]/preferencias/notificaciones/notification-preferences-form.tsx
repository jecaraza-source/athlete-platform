'use client';

import { useState } from 'react';
import { updateNotificationPreferences } from './actions';

type Pref = { enabled: boolean; is_mandatory: boolean; updated_at?: string | null };

export default function NotificationPreferencesForm({
  profileId,
  preferences,
}: {
  profileId:   string;
  preferences: { email: Pref; push: Pref };
}) {
  const [emailEnabled, setEmailEnabled] = useState(preferences.email.enabled);
  const [pushEnabled,  setPushEnabled]  = useState(preferences.push.enabled);
  const [loading, setLoading]           = useState(false);
  const [saved, setSaved]               = useState(false);
  const [error, setError]               = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setSaved(false); setError(null);

    const fd = new FormData();
    fd.set('profile_id', profileId);
    fd.set('email_enabled', String(emailEnabled));
    fd.set('push_enabled',  String(pushEnabled));

    const res = await updateNotificationPreferences(fd);
    setLoading(false);
    if (res.error) setError(res.error);
    else setSaved(true);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {[
        {
          channel:    'email',
          label:      'Correo electrónico',
          desc:       'Recordatorios y notificaciones de tickets por email.',
          enabled:    emailEnabled,
          setEnabled: setEmailEnabled,
          mandatory:  preferences.email.is_mandatory,
          updatedAt:  preferences.email.updated_at ?? null,
        },
        {
          channel:    'push',
          label:      'Notificaciones push',
          desc:       'Alertas en tu dispositivo móvil.',
          enabled:    pushEnabled,
          setEnabled: setPushEnabled,
          mandatory:  preferences.push.is_mandatory,
          updatedAt:  preferences.push.updated_at ?? null,
        },
      ].map((item) => (
        <div
          key={item.channel}
          className="flex items-center justify-between rounded-lg border border-gray-200 p-4"
        >
          <div>
            <p className="text-sm font-medium text-gray-800">{item.label}</p>
            <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
            {item.mandatory && (
              <p className="text-xs text-amber-600 mt-0.5">Obligatorio — no se puede desactivar.</p>
            )}
            {item.updatedAt && (
              <p className="text-xs text-gray-400 mt-0.5">
                Actualizado el{' '}
                {new Date(item.updatedAt).toLocaleDateString('es-MX', {
                  month: 'short', day: 'numeric', year: 'numeric',
                })}
              </p>
            )}
          </div>
          <button
            type="button"
            disabled={item.mandatory}
            onClick={() => item.setEnabled(!item.enabled)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
              item.enabled ? 'bg-rose-600' : 'bg-gray-200'
            } ${item.mandatory ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            aria-pressed={item.enabled}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                item.enabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      ))}

      {error  && <p className="text-sm text-red-600 bg-red-50 rounded p-3">{error}</p>}
      {saved  && <p className="text-sm text-green-700 bg-green-50 rounded p-3">Preferencias guardadas.</p>}

      <button
        type="submit"
        disabled={loading}
        className="rounded-md bg-rose-600 px-5 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50"
      >
        {loading ? 'Guardando…' : 'Guardar preferencias'}
      </button>
    </form>
  );
}
