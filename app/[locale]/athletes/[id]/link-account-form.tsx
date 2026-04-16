'use client';

import { useState, useTransition } from 'react';
import { updateAthlete } from './actions';

export type ProfileOption = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
};

export default function LinkAccountForm({
  athleteId,
  currentProfileId,
  profiles,
}: {
  athleteId: string;
  currentProfileId: string | null;
  profiles: ProfileOption[];
}) {
  const [selected, setSelected]     = useState(currentProfileId ?? '');
  const [isPending, startTransition] = useTransition();
  const [message, setMessage]        = useState<string | null>(null);
  const [isError, setIsError]        = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage(null);

    const fd = new FormData();
    fd.set('section', 'account');
    fd.set('profile_id', selected);

    startTransition(async () => {
      const result = await updateAthlete(athleteId, fd);
      if (result?.error) {
        setIsError(true);
        setMessage(result.error);
      } else {
        setIsError(false);
        setMessage('Cuenta vinculada correctamente. El atleta ya puede ver sus eventos en la app móvil.');
      }
    });
  }

  const currentProfile = profiles.find((p) => p.id === currentProfileId);

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {/* Current state */}
      {currentProfile ? (
        <p className="text-sm text-gray-700">
          <span className="font-medium">Cuenta actual:</span>{' '}
          {currentProfile.first_name} {currentProfile.last_name}
          {currentProfile.email ? (
            <span className="text-gray-500"> ({currentProfile.email})</span>
          ) : null}
        </p>
      ) : (
        <p className="text-sm text-amber-700 font-medium">
          ⚠ Sin cuenta vinculada — el atleta no verá sus eventos personalizados en la app.
        </p>
      )}

      {/* Profile selector */}
      <select
        value={selected}
        onChange={(e) => { setSelected(e.target.value); setMessage(null); }}
        className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
      >
        <option value="">— Sin cuenta vinculada —</option>
        {profiles.map((p) => (
          <option key={p.id} value={p.id}>
            {p.first_name} {p.last_name}
            {p.email ? ` (${p.email})` : ''}
          </option>
        ))}
      </select>

      {message && (
        <p className={`text-xs ${isError ? 'text-red-600' : 'text-green-700'}`}>
          {message}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
      >
        {isPending ? 'Guardando…' : 'Guardar vinculación'}
      </button>
    </form>
  );
}
