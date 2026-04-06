'use client';

import { useRef, useState, useTransition } from 'react';
import { createProfile } from './actions';

const ROLES = [
  { value: 'super_admin', label: 'Super Admin' },
  { value: 'admin', label: 'Admin' },
  { value: 'athlete', label: 'Athlete' },
  { value: 'psychologist', label: 'Psychologist' },
  { value: 'trainer', label: 'Trainer' },
  { value: 'nutritionist', label: 'Nutritionist' },
  { value: 'physio', label: 'Physio' },
];

export default function NewStaffForm({
  hasExtendedColumns = true,
  presetRole,
  buttonLabel = '+ Add staff member',
}: {
  hasExtendedColumns?: boolean;
  presetRole?: string;
  buttonLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await createProfile(formData);
      if (result.error) {
        setError(result.error);
      } else {
        setError(null);
        setOpen(false);
        formRef.current?.reset();
      }
    });
  }

  return (
    <div className="mb-8">
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          {buttonLabel}
        </button>
      ) : (
        <div className="rounded-lg border border-gray-200 p-5">
          <h2 className="font-semibold mb-4">
            {presetRole === 'athlete' ? 'Add Athlete' : presetRole === 'super_admin' || presetRole === 'admin' ? 'New Admin' : 'New Staff Member'}
          </h2>

          {error && (
            <p className="mb-4 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </p>
          )}

          <form ref={formRef} action={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1" htmlFor="first_name">
                  First name <span className="text-red-500">*</span>
                </label>
                <input
                  id="first_name"
                  name="first_name"
                  type="text"
                  required
                  placeholder="e.g. María"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" htmlFor="last_name">
                  Last name <span className="text-red-500">*</span>
                </label>
                <input
                  id="last_name"
                  name="last_name"
                  type="text"
                  required
                  placeholder="e.g. García"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>

              {hasExtendedColumns && (
                presetRole ? (
                  <input type="hidden" name="role" value={presetRole} />
                ) : (
                  <div>
                    <label className="block text-sm font-medium mb-1" htmlFor="role">
                      Role <span className="text-red-500">*</span>
                    </label>
                    <select
                      id="role"
                      name="role"
                      required
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    >
                      <option value="">Select role…</option>
                      {ROLES.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )
              )}

              {hasExtendedColumns && (
                <div>
                  <label className="block text-sm font-medium mb-1" htmlFor="specialty">
                    Specialty
                  </label>
                  <input
                    id="specialty"
                    name="specialty"
                    type="text"
                    placeholder="e.g. Sports psychology, Strength & conditioning"
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
              )}

              {presetRole === 'athlete' && (
                <div>
                  <label className="block text-sm font-medium mb-1" htmlFor="school_or_club">
                    School / Club
                  </label>
                  <input
                    id="school_or_club"
                    name="school_or_club"
                    type="text"
                    placeholder="e.g. Athlete Academy"
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-1" htmlFor="email">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  placeholder="e.g. maria@example.com"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>

              {hasExtendedColumns && (
                <div>
                  <label className="block text-sm font-medium mb-1" htmlFor="phone">
                    Phone
                  </label>
                  <input
                    id="phone"
                    name="phone"
                    type="tel"
                    placeholder="e.g. +1 555 000 0000"
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={isPending}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {isPending ? 'Saving…' : presetRole === 'athlete' ? 'Add Athlete' : 'Save'}
              </button>
              <button
                type="button"
                onClick={() => { setOpen(false); setError(null); }}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
