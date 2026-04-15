'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { createProfile } from './actions';
import { DISCIPLINES } from '@/lib/types/diagnostic';

const ROLE_VALUES = ['super_admin', 'admin', 'athlete', 'psychologist', 'trainer', 'nutritionist', 'physio', 'medic'] as const;

export default function NewStaffForm({
  hasExtendedColumns = true,
  presetRole,
  buttonLabel = '+ Agregar',
}: {
  hasExtendedColumns?: boolean;
  presetRole?: string;
  buttonLabel?: string;
}) {
  const t = useTranslations('admin.staff');
  const tc = useTranslations('common');
  const roles = ROLE_VALUES.map((value) => ({
    value,
    label: t(`role${value.split('_').map((s: string) => s[0].toUpperCase() + s.slice(1)).join('')}` as Parameters<typeof t>[0]),
  }));
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await createProfile(formData);
      if (result.error) {
        setError(result.error);
      } else if ('athleteId' in result && result.athleteId) {
        // Redirigir al flujo de diagnóstico inicial del atleta recién creado
        router.push(`/athletes/${result.athleteId}/diagnostic`);
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
            {presetRole === 'athlete' ? t('addAthlete') : presetRole === 'super_admin' || presetRole === 'admin' ? t('newAdminTitle') : t('newStaffMemberTitle')}
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
                  {tc('firstName')} <span className="text-red-500">*</span>
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
                  {tc('lastName')} <span className="text-red-500">*</span>
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
                      {t('roleLabel')} <span className="text-red-500">*</span>
                    </label>
                    <select
                      id="role"
                      name="role"
                      required
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    >
                      <option value="">{t('selectRole')}</option>
                      {roles.map((r) => (
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
                    {t('specialty')}
                  </label>
                  <input
                    id="specialty"
                    name="specialty"
                    type="text"
                    placeholder={t('specialtyPlaceholder')}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
              )}

              {presetRole === 'athlete' && (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-1" htmlFor="discipline">
                      Disciplina <span className="text-red-500">*</span>
                    </label>
                    <select
                      id="discipline"
                      name="discipline"
                      required
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    >
                      <option value="">Seleccionar disciplina…</option>
                      {DISCIPLINES.map((d) => (
                        <option key={d.value} value={d.value}>
                          {d.block} — {d.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1" htmlFor="disability_status">
                      Persona con o sin Discapacidad <span className="text-red-500">*</span>
                    </label>
                    <select
                      id="disability_status"
                      name="disability_status"
                      required
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    >
                      <option value="">Seleccionar…</option>
                      <option value="sin_discapacidad">Sin discapacidad</option>
                      <option value="con_discapacidad">Con discapacidad</option>
                    </select>
                  </div>
                </>
              )}

              <div>
                <label className="block text-sm font-medium mb-1" htmlFor="email">
                  {tc('email')} <span className="text-red-500">*</span>
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
                    {tc('phone')}
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
                {isPending ? tc('saving') : presetRole === 'athlete' ? t('addAthlete') : tc('save')}
              </button>
              <button
                type="button"
                onClick={() => { setOpen(false); setError(null); }}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                {tc('cancel')}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
