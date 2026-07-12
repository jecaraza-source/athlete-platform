'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { deleteProfile } from './actions';

export default function DeleteStaffButton({ id }: { id: string }) {
  const tc = useTranslations('common');
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteProfile(id);
      if (result.error) {
        setError(result.error);
        setConfirming(false);
      }
    });
  }

  if (error) {
    return (
      <span className="text-xs text-red-600" title={error}>
        Error — {error}
      </span>
    );
  }

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="text-xs text-red-500 hover:text-red-700 hover:underline"
      >
        {tc('delete')}
      </button>
    );
  }

  return (
    <span className="flex items-center gap-2 text-xs">
      <span className="text-gray-600">{tc('areYouSure')}</span>
      <button
        onClick={handleDelete}
        disabled={isPending}
        className="text-red-600 font-medium hover:underline disabled:opacity-50"
      >
        {isPending ? tc('deleting') : tc('yesDelete')}
      </button>
      <button
        onClick={() => setConfirming(false)}
        className="text-gray-500 hover:underline"
      >
        {tc('cancel')}
      </button>
    </span>
  );
}
