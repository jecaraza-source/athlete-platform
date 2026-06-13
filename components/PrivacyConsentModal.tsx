'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { acceptPrivacyConsent } from '@/lib/actions/privacy-consent';

export default function PrivacyConsentModal() {
  const t = useTranslations('privacyConsent');
  const locale = useLocale();
  const [checked, setChecked] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleAccept() {
    if (!checked) return;
    startTransition(async () => {
      const result = await acceptPrivacyConsent();
      if (result.error) setError(result.error);
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-gray-100">
          <div className="flex items-center gap-3 mb-1">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-50">
              <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.955 11.955 0 003 9.749c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
            </span>
            <h2 className="text-lg font-bold text-gray-900">{t('title')}</h2>
          </div>
          <p className="text-sm text-gray-500">{t('subtitle')}</p>
        </div>

        {/* Body */}
        <div className="px-6 py-5 overflow-y-auto flex-1 text-sm text-gray-600 space-y-3">
          <p>{t('intro')}</p>
          <ul className="list-disc list-inside space-y-1 text-gray-500">
            <li>{t('bullet1')}</li>
            <li>{t('bullet2')}</li>
            <li>{t('bullet3')}</li>
            <li>{t('bullet4')}</li>
          </ul>
          <p>{t('closedGroup')}</p>
        </div>

        {/* Checkbox */}
        <div className="px-6 py-4 border-t border-gray-100">
          <label className="flex items-start gap-3 cursor-pointer group">
            <div className="relative mt-0.5 shrink-0">
              <input
                type="checkbox"
                checked={checked}
                onChange={(e) => setChecked(e.target.checked)}
                className="peer sr-only"
                id="consent-checkbox"
              />
              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                checked
                  ? 'bg-indigo-600 border-indigo-600'
                  : 'border-gray-300 bg-white group-hover:border-indigo-400'
              }`}>
                {checked && (
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
            </div>
            <span className="text-sm text-gray-700 leading-snug">
              {t('checkboxLabel')}{' '}
              <Link
                href={`/${locale}/privacy-policy`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-indigo-600 hover:underline"
              >
                {t('privacyLink')}
              </Link>
              {' '}{t('and')}{' '}
              <Link
                href={`/${locale}/privacy-policy#terms`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-indigo-600 hover:underline"
              >
                {t('termsLink')}
              </Link>
              .
            </span>
          </label>

          {error && (
            <p className="mt-2 text-xs text-red-600">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 pt-2">
          <button
            onClick={handleAccept}
            disabled={!checked || isPending}
            className="w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isPending ? t('accepting') : t('acceptButton')}
          </button>
          <p className="mt-3 text-center text-xs text-gray-400">{t('footer')}</p>
        </div>
      </div>
    </div>
  );
}
