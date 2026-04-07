'use client';

import { useRef, useState, useTransition } from 'react';
import { updateRole } from '../actions';
import type { Role } from '@/lib/rbac/types';

export default function EditRoleForm({ role }: { role: Role }) {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await updateRole(role.id, formData);
      if (result.error) {
        setError(result.error);
        setSuccess(false);
      } else {
        setError(null);
        setSuccess(true);
      }
    });
  }

  return (
    <form ref={formRef} action={handleSubmit} className="space-y-4 max-w-md">
      {error && (
        <p className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</p>
      )}
      {success && (
        <p className="rounded border border-green-300 bg-green-50 p-3 text-sm text-green-700">
          Saved successfully.
        </p>
      )}

      <div>
        <label className="block text-sm font-medium mb-1">Role name</label>
        <input
          type="text"
          value={role.name}
          disabled
          className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500 cursor-not-allowed"
        />
        <p className="mt-1 text-xs text-gray-400">Role names cannot be changed after creation.</p>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1" htmlFor="description">
          Description
        </label>
        <input
          id="description"
          name="description"
          type="text"
          defaultValue={role.description ?? ''}
          placeholder="What is this role for?"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
        />
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50 transition-colors"
      >
        {isPending ? 'Saving…' : 'Save changes'}
      </button>
    </form>
  );
}
