'use client';

import { useTransition } from 'react';
import { signOut } from '@/app/login/actions';

export default function SignOutButton() {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      onClick={() => startTransition(() => signOut())}
      disabled={isPending}
      className="w-full text-left text-xs font-medium text-gray-500 hover:text-gray-800 px-3 py-2 rounded-md hover:bg-gray-200/70 transition-colors disabled:opacity-50"
    >
      {isPending ? 'Signing out…' : 'Sign out'}
    </button>
  );
}
