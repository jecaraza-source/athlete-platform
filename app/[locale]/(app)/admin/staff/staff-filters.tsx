'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import StaffCard, { type Profile } from './staff-card';

export default function StaffFilters({
  staff,
  hasExtendedColumns,
}: {
  staff: Profile[];
  hasExtendedColumns: boolean;
}) {
  const t = useTranslations('admin.staff');

  const [search, setSearch]           = useState('');
  const [specialty, setSpecialty]     = useState('');
  const [role, setRole]               = useState('');

  // Unique non-empty specialties present in this staff list
  const specialties = useMemo(
    () =>
      Array.from(
        new Set(staff.map((p) => p.specialty).filter(Boolean) as string[]),
      ).sort(),
    [staff],
  );

  // Unique non-empty roles present in this staff list
  const roles = useMemo(
    () =>
      Array.from(
        new Set(staff.map((p) => p.role).filter(Boolean) as string[]),
      ).sort(),
    [staff],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return staff.filter((p) => {
      if (q) {
        const fullName = `${p.first_name} ${p.last_name}`.toLowerCase();
        if (!fullName.includes(q)) return false;
      }
      if (specialty && p.specialty !== specialty) return false;
      if (role && p.role !== role) return false;
      return true;
    });
  }, [staff, search, specialty, role]);

  const hasFilters = search.trim() || specialty || role;

  return (
    <div className="space-y-4">
      {/* Filter controls */}
      <div className="flex flex-wrap gap-3">
        {/* Search */}
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('searchPlaceholder')}
          className="flex-1 min-w-[180px] rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-300"
        />

        {/* Specialty filter */}
        {hasExtendedColumns && (
          <select
            value={specialty}
            onChange={(e) => setSpecialty(e.target.value)}
            className="rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-300"
          >
            <option value="">{t('allSpecialties')}</option>
            {specialties.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        )}

        {/* Role filter */}
        {roles.length > 0 && (
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-300"
          >
            <option value="">{t('allRoles')}</option>
            {roles.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        )}

        {/* Clear button */}
        {hasFilters && (
          <button
            type="button"
            onClick={() => { setSearch(''); setSpecialty(''); setRole(''); }}
            className="rounded border border-gray-300 px-3 py-2 text-sm text-gray-500 hover:bg-gray-50 transition-colors"
          >
            ✕
          </button>
        )}
      </div>

      {/* Results */}
      {staff.length === 0 ? (
        <p className="text-sm text-gray-500">{t('noStaff')}</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-gray-500">{t('noResults')}</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((p) => (
            <StaffCard key={p.id} profile={p} hasExtendedColumns={hasExtendedColumns} />
          ))}
        </div>
      )}
    </div>
  );
}
