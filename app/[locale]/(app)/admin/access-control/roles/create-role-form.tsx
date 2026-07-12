'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { createRole } from './actions';

export default function CreateRoleForm() {
  const t = useTranslations('admin.accessControl.roles');
  const tc = useTranslations('common');
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);

  // Focus the first field when the drawer opens
  useEffect(() => {
    if (open) firstInputRef.current?.focus();
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
    formRef.current?.reset();
  }

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await createRole(formData);
      if (result.error) {
        setError(result.error);
      } else {
        close();
      }
    });
  }

  return (
    <>
      {/* Trigger */}
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 transition-colors"
      >
        {t('newTrigger')}
      </button>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 bg-black/20 z-40"
          aria-hidden
          onClick={close}
        />
      )}

      {/* Slide-over panel */}
      <div
        className={`fixed inset-y-0 right-0 z-50 w-full max-w-sm bg-white shadow-2xl flex flex-col
          transform transition-transform duration-200 ease-in-out
          ${ open ? 'translate-x-0' : 'translate-x-full' }`}
        role="dialog"
        aria-modal="true"
        aria-label="Create new role"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">{t('newTitle')}</h2>
          <button
            onClick={close}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <form ref={formRef} action={handleSubmit} id="create-role-form" className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5" htmlFor="role-name">
                {tc('name')} <span className="text-red-500">*</span>
              </label>
              <input
                ref={firstInputRef}
                id="role-name"
                name="name"
                type="text"
                required
                placeholder={t('namePlaceholder')}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
              />
              <p className="mt-1.5 text-xs text-gray-400">
                {tc('lowercaseHint')}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5" htmlFor="role-desc">
                {tc('description')}
              </label>
              <textarea
                id="role-desc"
                name="description"
                rows={3}
                placeholder={t('descriptionPlaceholder')}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm resize-none focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
              />
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button
            type="submit"
            form="create-role-form"
            disabled={isPending}
            className="flex-1 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50 transition-colors"
          >
            {isPending ? tc('creating') : t('createRole')}
          </button>
          <button
            type="button"
            onClick={close}
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
          >
            {tc('cancel')}
          </button>
        </div>
      </div>
    </>
  );
}
