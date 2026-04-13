'use client';

import { useLocale } from 'next-intl';
import { useRouter, usePathname } from '@/i18n/navigation';
import { useTransition } from 'react';

const LOCALES = [
  { code: 'en', label: 'EN' },
  { code: 'es', label: 'ES' },
] as const;

export default function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  function switchLocale(next: string) {
    if (next === locale) return;
    startTransition(() => {
      router.replace(pathname, { locale: next });
    });
  }

  return (
    <div className="flex items-center gap-1 px-3 py-2">
      {LOCALES.map(({ code, label }) => (
        <button
          key={code}
          onClick={() => switchLocale(code)}
          disabled={isPending}
          className={`flex-1 rounded-md py-1 text-xs font-semibold transition-colors disabled:opacity-50 ${
            locale === code
              ? 'bg-gray-200 text-gray-900'
              : 'text-gray-400 hover:bg-gray-100 hover:text-gray-700'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
