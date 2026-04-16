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
import { useTranslations } from 'next-intl';
import { supabase } from '@/lib/supabase';

type Step = 'loading' | 'form' | 'success' | 'error';

export default function AuthConfirmPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const t = useTranslations('auth');

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
      setPageError('invalidLinkExpired');
      setStep('error');
      return;
    }

    supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
      if (error) {
        setPageError('invalidLinkUsed');
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
      setFormError(t('passwordRequired'));
      return false;
    }
    if (password.length < 6) {
      setFormError(t('passwordTooShort'));
      return false;
    }
    if (password !== confirm) {
      setFormError(t('passwordMismatch'));
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

  // ── Loading ───────────────────────────────────────────────────────────────────────
  if (step === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-sm text-gray-500 animate-pulse">{t('verifyingLink')}</p>
      </div>
    );
  }

  // ── Error ───────────────────────────────────────────────────────────────────────
  if (step === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold text-gray-900">{t('invalidLinkTitle')}</h1>
            <p className="mt-1 text-sm text-gray-500">AO Deportes</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm text-center space-y-4">
            <p className="text-sm text-red-600">
              {pageError === 'invalidLinkUsed' ? t('invalidLinkUsed') : t('invalidLinkExpired')}
            </p>
            <button
              onClick={() => router.push('/login/forgot-password')}
              className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors"
            >
              {t('requestNewLink')}
            </button>
            <button
              onClick={() => router.push('/login')}
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              {t('backToLogin')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Success ───────────────────────────────────────────────────────────────────────
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
            <p className="text-sm font-semibold text-gray-800">{t('passwordUpdatedTitle')}</p>
            <p className="text-xs text-gray-500">{t('passwordUpdatedDesc')}</p>
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
          <h1 className="text-2xl font-bold text-gray-900">{t('newPasswordTitle')}</h1>
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
                {t('newPasswordLabel')}
              </label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                required
                placeholder={t('newPasswordPlaceholder')}
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
                {t('confirmPasswordLabel')}
              </label>
              <input
                id="confirm"
                type="password"
                autoComplete="new-password"
                required
                placeholder={t('confirmPasswordPlaceholder')}
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
              {isPending ? t('savingPassword') : t('savePassword')}
            </button>
          </div>

          <div className="mt-4 text-center">
            <button
              onClick={() => router.push('/login')}
              className="text-sm text-indigo-600 hover:text-indigo-800 hover:underline"
            >
              ← {t('backToLogin')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
