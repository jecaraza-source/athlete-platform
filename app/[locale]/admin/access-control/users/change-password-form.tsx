'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { changeUserPassword } from './actions';

export default function ChangePasswordForm({ authUserId }: { authUserId: string }) {
  const [open, setOpen]       = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus the input when the form opens
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  function close() {
    setOpen(false);
    setError(null);
    setSuccess(false);
    if (inputRef.current) inputRef.current.value = '';
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const password = inputRef.current?.value ?? '';
    startTransition(async () => {
      const result = await changeUserPassword(authUserId, password);
      if (result.error) {
        setError(result.error);
      } else {
        setError(null);
        setSuccess(true);
        // Auto-close after a short success flash
        setTimeout(close, 1800);
      }
    });
  }

  if (success) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-green-600 font-medium">
        <span>✓</span> Password updated
      </span>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-gray-400 hover:text-violet-600 hover:underline transition-colors"
      >
        Change password
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-1 flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5 flex-wrap">
        <input
          ref={inputRef}
          type="password"
          required
          minLength={8}
          placeholder="New password (min 8 chars)"
          className="w-44 rounded border border-gray-300 px-2 py-1 text-xs focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
        />
        <button
          type="submit"
          disabled={isPending}
          className="rounded bg-violet-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-violet-700 disabled:opacity-50 transition-colors"
        >
          {isPending ? 'Saving…' : 'Set'}
        </button>
        <button
          type="button"
          onClick={close}
          className="text-xs text-gray-400 hover:text-gray-600"
        >
          Cancel
        </button>
      </div>
      {error && (
        <p className="text-xs text-red-600">{error}</p>
      )}
    </form>
  );
}
