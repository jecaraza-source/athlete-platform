'use client';

import { useRef, useState, useTransition } from 'react';
import { updateAthlete } from './actions';

type AthleteDetail = {
  id: string;
  date_of_birth: string | null;
  sex: string | null;
  dominant_side: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  school_or_club: string | null;
  guardian_name: string | null;
  guardian_phone: string | null;
  guardian_email: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  medical_notes_summary: string | null;
};

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <p>
      <span className="font-medium">{label}:</span>{' '}
      <span className="capitalize">{value ?? 'N/A'}</span>
    </p>
  );
}

function EditSection({
  title,
  section,
  athleteId,
  children,
  form,
}: {
  title: string;
  section: string;
  athleteId: string;
  children: React.ReactNode;
  form: React.ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await updateAthlete(athleteId, formData);
      if (result.error) {
        setError(result.error);
      } else {
        setError(null);
        setEditing(false);
      }
    });
  }

  return (
    <div className="rounded-lg border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold">{title}</h2>
        {!editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-xs text-blue-600 hover:underline"
          >
            Edit
          </button>
        )}
      </div>

      {!editing ? (
        <div className="space-y-2 text-sm">{children}</div>
      ) : (
        <>
          {error && (
            <p className="mb-3 rounded border border-red-300 bg-red-50 p-2 text-xs text-red-700">{error}</p>
          )}
          <form ref={formRef} action={handleSubmit} className="space-y-3">
            <input type="hidden" name="section" value={section} />
            <div className="space-y-3 text-sm">{form}</div>
            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                disabled={isPending}
                className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {isPending ? 'Saving…' : 'Save'}
              </button>
              <button
                type="button"
                onClick={() => { setEditing(false); setError(null); }}
                className="rounded border border-gray-300 px-3 py-1.5 text-xs font-medium hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </>
      )}
    </div>
  );
}

function FormField({
  label, name, type = 'text', defaultValue, options, placeholder,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string | number | null;
  options?: { value: string; label: string }[];
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium mb-0.5">{label}</label>
      {options ? (
        <select
          name={name}
          defaultValue={defaultValue?.toString() ?? ''}
          className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
        >
          <option value="">N/A</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      ) : (
        <input
          name={name}
          type={type}
          defaultValue={defaultValue?.toString() ?? ''}
          placeholder={placeholder}
          className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
        />
      )}
    </div>
  );
}

export function GeneralInfoSection({ athlete }: { athlete: AthleteDetail }) {
  return (
    <EditSection
      title="General Information"
      section="general"
      athleteId={athlete.id}
      children={
        <>
          <Field label="Date of birth" value={athlete.date_of_birth ? new Date(athlete.date_of_birth).toLocaleDateString() : null} />
          <Field label="Sex" value={athlete.sex} />
          <Field label="Dominant side" value={athlete.dominant_side} />
          <Field label="Height" value={athlete.height_cm != null ? `${athlete.height_cm} cm` : null} />
          <Field label="Weight" value={athlete.weight_kg != null ? `${athlete.weight_kg} kg` : null} />
          <Field label="School / Club" value={athlete.school_or_club} />
        </>
      }
      form={
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Date of birth" name="date_of_birth" type="date" defaultValue={athlete.date_of_birth} />
          <FormField label="Sex" name="sex" options={[{ value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }, { value: 'other', label: 'Other' }]} defaultValue={athlete.sex} />
          <FormField label="Dominant side" name="dominant_side" options={[{ value: 'left', label: 'Left' }, { value: 'right', label: 'Right' }, { value: 'both', label: 'Both' }]} defaultValue={athlete.dominant_side} />
          <FormField label="Height (cm)" name="height_cm" type="number" defaultValue={athlete.height_cm} placeholder="e.g. 170" />
          <FormField label="Weight (kg)" name="weight_kg" type="number" defaultValue={athlete.weight_kg} placeholder="e.g. 65" />
          <FormField label="School / Club" name="school_or_club" defaultValue={athlete.school_or_club} placeholder="e.g. Athlete Academy" />
        </div>
      }
    />
  );
}

export function GuardianSection({ athlete }: { athlete: AthleteDetail }) {
  return (
    <EditSection
      title="Guardian"
      section="guardian"
      athleteId={athlete.id}
      children={
        <>
          <Field label="Name" value={athlete.guardian_name} />
          <Field label="Phone" value={athlete.guardian_phone} />
          <Field label="Email" value={athlete.guardian_email} />
        </>
      }
      form={
        <>
          <FormField label="Name" name="guardian_name" defaultValue={athlete.guardian_name} placeholder="Full name" />
          <FormField label="Phone" name="guardian_phone" type="tel" defaultValue={athlete.guardian_phone} placeholder="+1 555 000 0000" />
          <FormField label="Email" name="guardian_email" type="email" defaultValue={athlete.guardian_email} placeholder="email@example.com" />
        </>
      }
    />
  );
}

export function EmergencyContactSection({ athlete }: { athlete: AthleteDetail }) {
  return (
    <EditSection
      title="Emergency Contact"
      section="emergency"
      athleteId={athlete.id}
      children={
        <>
          <Field label="Name" value={athlete.emergency_contact_name} />
          <Field label="Phone" value={athlete.emergency_contact_phone} />
          {athlete.medical_notes_summary && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Medical notes</p>
              <p className="text-gray-600">{athlete.medical_notes_summary}</p>
            </div>
          )}
        </>
      }
      form={
        <>
          <FormField label="Name" name="emergency_contact_name" defaultValue={athlete.emergency_contact_name} placeholder="Full name" />
          <FormField label="Phone" name="emergency_contact_phone" type="tel" defaultValue={athlete.emergency_contact_phone} placeholder="+1 555 000 0000" />
          <div>
            <label className="block text-xs font-medium mb-0.5">Medical notes</label>
            <textarea
              name="medical_notes_summary"
              rows={3}
              defaultValue={athlete.medical_notes_summary ?? ''}
              placeholder="Relevant medical conditions, allergies…"
              className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm resize-none"
            />
          </div>
        </>
      }
    />
  );
}
