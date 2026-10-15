'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { savePsychInstrumentLicenseCheck } from '@/app/[locale]/(app)/dashboard/mental-health/actions';

type LicenseStatus = 'pending_review' | 'licensed' | 'not_required' | 'denied';

type Instrument = {
  id: string;
  code: string;
  name: string;
  licenseStatus: LicenseStatus;
  checks: LicenseCheck[];
};
type LicenseCheck = {
  permissionType: PermissionType;
  status: LicenseStatus;
  notes: string;
};
type PermissionType = 'instrument_use' | 'digital_reproduction' | 'official_scoring' | 'spanish_translation';

const PERMISSIONS: PermissionType[] = ['instrument_use', 'digital_reproduction', 'official_scoring', 'spanish_translation'];
const STATUSES: LicenseStatus[] = ['pending_review', 'licensed', 'not_required', 'denied'];

const STATUS_STYLES: Record<LicenseStatus, string> = {
  pending_review: 'bg-amber-50 text-amber-800 ring-amber-200',
  licensed: 'bg-green-50 text-green-800 ring-green-200',
  not_required: 'bg-sky-50 text-sky-800 ring-sky-200',
  denied: 'bg-red-50 text-red-800 ring-red-200',
};

export function LicenseStatusManager({ instruments }: { instruments: Instrument[] }) {
  const t = useTranslations('psych.clinical.license');
  const tc = useTranslations('psych.common');
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function save(instrument: Instrument, permissionType: PermissionType, form: HTMLFormElement) {
    const data = new FormData(form);
    setPendingId(`${instrument.id}:${permissionType}`);
    startTransition(async () => {
      const result = await savePsychInstrumentLicenseCheck({
        instrumentId: instrument.id,
        permissionType,
        status: String(data.get('status')),
        notes: String(data.get('notes') ?? ''),
      });
      setError(result.error ?? null);
      setPendingId(null);
    });
  }

  return (
    <section className="mt-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#C0172C]">{t('eyebrow')}</p>
          <h2 className="mt-1 text-2xl font-bold text-[#2D2D2D]">{t('title')}</h2>
          <p className="mt-1 text-sm text-gray-600">{t('description')}</p>
        </div>
        <button
          type="button"
          onClick={() => setIsOpen((open) => !open)}
          aria-expanded={isOpen}
          aria-controls="psych-license-checks"
          className="rounded-lg border border-[#C0172C] px-3 py-2 text-sm font-semibold text-[#C0172C] transition hover:bg-red-50"
        >
          {isOpen ? t('hide') : t('show')}
        </button>
      </div>
      {isOpen && (
        <div id="psych-license-checks" className="mt-4 space-y-4">
          {error && <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
          {instruments.map((instrument) => (
            <article
              key={instrument.id}
              className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#C0172C]">{instrument.code}</p>
                  <h3 className="mt-1 font-bold text-[#2D2D2D]">{instrument.name}</h3>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${STATUS_STYLES[instrument.licenseStatus]}`}>
                  {tc(`licenseStatus.${instrument.licenseStatus}`)}
                </span>
              </div>
              <p className="mt-3 text-sm text-gray-600">{t('derivedNote')}</p>
              <div className="mt-4 space-y-3">
                {PERMISSIONS.map((permission) => {
                  const check = instrument.checks.find((candidate) => candidate.permissionType === permission) ?? {
                    permissionType: permission,
                    status: 'pending_review' as const,
                    notes: '',
                  };
                  const key = `${instrument.id}:${permission}`;
                  return (
                    <form
                      key={permission}
                      onSubmit={(event) => {
                        event.preventDefault();
                        save(instrument, permission, event.currentTarget);
                      }}
                      className="grid gap-3 border-t border-gray-100 pt-3 lg:grid-cols-[180px_180px_minmax(240px,2fr)_auto]"
                    >
                      <p className="self-center text-sm font-semibold text-[#2D2D2D]">{tc(`licensePermission.${permission}`)}</p>
                      <select name="status" defaultValue={check.status} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-[#C0172C] focus:outline-none focus:ring-2 focus:ring-red-100">
                        {STATUSES.map((status) => <option key={status} value={status}>{tc(`licenseStatus.${status}`)}</option>)}
                      </select>
                      <textarea name="notes" defaultValue={check.notes} rows={2} placeholder={t('notesPlaceholder')} className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:border-[#C0172C] focus:outline-none focus:ring-2 focus:ring-red-100" />
                      <button type="submit" disabled={isPending && pendingId === key} className="self-start rounded-lg border border-[#C0172C] px-3 py-2 text-sm font-semibold text-[#C0172C] transition hover:bg-red-50 disabled:opacity-60">
                        {isPending && pendingId === key ? tc('saving') : tc('save')}
                      </button>
                    </form>
                  );
                })}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
