'use client';

import { useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { signOut } from '@/app/[locale]/login/actions';

export default function SignOutButton() {
  const [isPending, startTransition] = useTransition();
  const t = useTranslations('auth');

  return (
    <button
      onClick={() => startTransition(() => signOut())}
      disabled={isPending}
      className="w-full text-left text-xs font-medium text-gray-500 hover:text-gray-800 px-3 py-2 rounded-md hover:bg-gray-200/70 transition-colors disabled:opacity-50"
    >
      {isPending ? t('signingOut') : t('signOut')}
    </button>
  );
}
