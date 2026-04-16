'use client';

/**
 * /auth/confirm
 *
 * Supabase password-reset callback page.
 *
 * Flow:
 *  1. User requests a reset on /login/forgot-password.
 *  2. Supabase emails a link to ${NEXT_PUBLIC_APP_URL}/auth/confirm?code=XXXXX.
 *  3. proxy.ts redirects /auth/confirm → /{locale}/auth/confirm (locale prefix added).
 *  4. proxy.ts allows the path through because '/auth/confirm' is in PUBLIC_PATHS.
 *  5. This page reads `?code`, calls supabase.auth.exchangeCodeForSession(code),
 *     then presents a new-password form.
 *  6. On success, supabase.auth.updateUser({ password }) is called and the user
 *     is redirected to /dashboard.
 */

import { useEffect, useState, useTransition } from 'react';
import { useSearchParams } from 'next/navigation';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

type Step = 'loading' | 'form' | 'success' | 'error';

export default function AuthConfirmPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [step, setStep] = useState<Step>('loading');
  const [pageError, setPageError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [isPending, startTransition] = useTransition();

  // Exchange the one-time code for a session as soon as the page loads.
  useEffect(() => {
    const code = searchParams.get('code');

    if (!code) {
      setPageError(
        'El enlace de recuperación es inválido o ha expirado. ' +
        'Solicita uno nuevo desde la página de inicio de sesión.'
      );
      setStep('error');
      return;
    }

    supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
      if (error) {
        setPageError(
          'El enlace ya fue utilizado o ha expirado. ' +
          'Por favor solicita un nuevo enlace de recuperación.'
        );
        setStep('error');
      } else {
        setStep('form');
      }
    });
    // searchParams is stable; disabling exhaustive-deps intentionally
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function validate(): boolean {
    if (!password.trim()) {
      setFormError('La contraseña no puede estar vacía.');
      return false;
    }
    if (password.length < 6) {
      setFormError('La contraseña debe tener al menos 6 caracteres.');
      return false;
    }
    if (password !== confirm) {
      setFormError('Las contraseñas no coinciden.');
      return false;
    }
    return true;
  }

  function handleSubmit() {
    if (!validate()) return;
    setFormError(null);

    startTransition(async () => {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setFormError(error.message);
      } else {
        setStep('success');
        // Brief pause so the user reads the success message, then go to dashboard.
        setTimeout(() => router.replace('/dashboard'), 1800);
      }
    });
  }

  // ── Loading ──────────────────────────────────────────────────────────────
  if (step === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-sm text-gray-500 animate-pulse">Verificando enlace…</p>
      </div>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────
  if (step === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold text-gray-900">Enlace inválido</h1>
            <p className="mt-1 text-sm text-gray-500">AO Deportes</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm text-center space-y-4">
            <p className="text-sm text-red-600">{pageError}</p>
            <button
              onClick={() => router.push('/login/forgot-password')}
              className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors"
            >
              Solicitar nuevo enlace
            </button>
            <button
              onClick={() => router.push('/login')}
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Volver al inicio de sesión
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Success ──────────────────────────────────────────────────────────────
  if (step === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-sm">
          <div className="rounded-xl border border-green-200 bg-white p-8 shadow-sm text-center space-y-3">
            <span className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </span>
            <p className="text-sm font-semibold text-gray-800">Contraseña actualizada</p>
            <p className="text-xs text-gray-500">Redirigiendo al dashboard…</p>
          </div>
        </div>
      </div>
    );
  }

  // ── Form ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900">Nueva contraseña</h1>
          <p className="mt-1 text-sm text-gray-500">AO Deportes</p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
          {formError && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {formError}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Nueva contraseña
              </label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                required
                placeholder="Mínimo 6 caracteres"
                value={password}
                onChange={(e) => { setFormError(null); setPassword(e.target.value); }}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label
                htmlFor="confirm"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Confirmar contraseña
              </label>
              <input
                id="confirm"
                type="password"
                autoComplete="new-password"
                required
                placeholder="Repite la contraseña"
                value={confirm}
                onChange={(e) => { setFormError(null); setConfirm(e.target.value); }}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <button
              onClick={handleSubmit}
              disabled={isPending}
              className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {isPending ? 'Guardando…' : 'Guardar nueva contraseña'}
            </button>
          </div>

          <div className="mt-4 text-center">
            <button
              onClick={() => router.push('/login')}
              className="text-sm text-indigo-600 hover:text-indigo-800 hover:underline"
            >
              ← Volver al inicio de sesión
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
