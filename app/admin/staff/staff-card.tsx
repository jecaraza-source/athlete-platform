'use client';

import { useState, useRef, useTransition } from 'react';
import { updateProfile } from './actions';
import DeleteStaffButton from './delete-staff-button';

export type Profile = {
  id: string;
  first_name: string;
  last_name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  specialty: string | null;
};

const ROLES = [
  { value: 'super_admin', label: 'Super Admin' },
  { value: 'admin', label: 'Admin' },
  { value: 'athlete', label: 'Athlete' },
  { value: 'psychologist', label: 'Psychologist' },
  { value: 'trainer', label: 'Trainer' },
  { value: 'nutritionist', label: 'Nutritionist' },
  { value: 'physio', label: 'Physio' },
];

const roleBadgeColors: Record<string, string> = {
  super_admin: 'bg-red-100 text-red-700',
  admin: 'bg-indigo-100 text-indigo-700',
  athlete: 'bg-teal-100 text-teal-700',
  psychologist: 'bg-purple-100 text-purple-700',
  trainer: 'bg-blue-100 text-blue-700',
  nutritionist: 'bg-green-100 text-green-700',
  physio: 'bg-orange-100 text-orange-700',
};

export default function StaffCard({
  profile: initialProfile,
  hasExtendedColumns,
}: {
  profile: Profile;
  hasExtendedColumns: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [profile, setProfile] = useState(initialProfile);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await updateProfile(profile.id, formData);
      if (result.error) {
        setError(result.error);
      } else {
        setError(null);
        setEditing(false);
        setProfile({
          ...profile,
          first_name: formData.get('first_name') as string,
          last_name: formData.get('last_name') as string,
          role: (formData.get('role') as string) || profile.role,
          email: (formData.get('email') as string) || null,
          phone: (formData.get('phone') as string) || null,
          specialty: (formData.get('specialty') as string) || null,
        });
      }
    });
  }

  if (editing) {
    return (
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-5 flex flex-col gap-3">
        <h3 className="font-semibold text-sm">Edit Staff Member</h3>

        {error && (
          <p className="rounded border border-red-300 bg-red-50 p-2 text-xs text-red-700">
            {error}
          </p>
        )}

        <form ref={formRef} action={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1" htmlFor={`fn-${profile.id}`}>
                First name <span className="text-red-500">*</span>
              </label>
              <input
                id={`fn-${profile.id}`}
                name="first_name"
                type="text"
                required
                defaultValue={profile.first_name}
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" htmlFor={`ln-${profile.id}`}>
                Last name <span className="text-red-500">*</span>
              </label>
              <input
                id={`ln-${profile.id}`}
                name="last_name"
                type="text"
                required
                defaultValue={profile.last_name}
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
              />
            </div>
          </div>

          {hasExtendedColumns && (
            <>
              <div>
                <label className="block text-xs font-medium mb-1" htmlFor={`role-${profile.id}`}>
                  Role
                </label>
                <select
                  id={`role-${profile.id}`}
                  name="role"
                  defaultValue={profile.role ?? ''}
                  className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                >
                  <option value="">Select role…</option>
                  {ROLES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1" htmlFor={`spec-${profile.id}`}>
                  Specialty
                </label>
                <input
                  id={`spec-${profile.id}`}
                  name="specialty"
                  type="text"
                  defaultValue={profile.specialty ?? ''}
                  placeholder="e.g. Sports psychology, Strength & conditioning"
                  className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1" htmlFor={`email-${profile.id}`}>
                  Email
                </label>
                <input
                  id={`email-${profile.id}`}
                  name="email"
                  type="email"
                  defaultValue={profile.email ?? ''}
                  placeholder="e.g. name@example.com"
                  className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1" htmlFor={`phone-${profile.id}`}>
                  Phone
                </label>
                <input
                  id={`phone-${profile.id}`}
                  name="phone"
                  type="tel"
                  defaultValue={profile.phone ?? ''}
                  placeholder="e.g. +1 555 000 0000"
                  className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                />
              </div>
            </>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={isPending}
              className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {isPending ? 'Saving…' : 'Save changes'}
            </button>
            <button
              type="button"
              onClick={() => { setEditing(false); setError(null); }}
              className="rounded border border-gray-300 px-3 py-1.5 text-xs font-medium hover:bg-white transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold">
            {profile.first_name} {profile.last_name}
          </p>
          {profile.specialty && (
            <p className="text-xs text-gray-500 mt-0.5">{profile.specialty}</p>
          )}
        </div>
        {profile.role && (
          <span
            className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full capitalize ${
              roleBadgeColors[profile.role] ?? 'bg-gray-100 text-gray-600'
            }`}
          >
            {profile.role}
          </span>
        )}
      </div>

      <div className="text-sm text-gray-600 space-y-1">
        {profile.email && (
          <p>
            <span className="font-medium">Email:</span>{' '}
            <a href={`mailto:${profile.email}`} className="text-blue-600 hover:underline">
              {profile.email}
            </a>
          </p>
        )}
        {profile.phone && (
          <p>
            <span className="font-medium">Phone:</span> {profile.phone}
          </p>
        )}
        {!profile.email && !profile.phone && hasExtendedColumns && (
          <p className="text-xs text-gray-400 italic">No contact info yet.</p>
        )}
      </div>

      <div className="mt-auto pt-2 border-t border-gray-100 flex items-center justify-between">
        <button
          onClick={() => setEditing(true)}
          className="text-xs text-blue-600 hover:text-blue-800 hover:underline"
        >
          Edit
        </button>
        <DeleteStaffButton id={profile.id} />
      </div>
    </div>
  );
}
