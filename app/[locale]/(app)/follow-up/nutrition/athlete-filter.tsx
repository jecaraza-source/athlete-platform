'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';

type Athlete = { id: string; first_name: string; last_name: string };

export default function AthleteFilter({ athletes, selectedId }: { athletes: Athlete[]; selectedId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const params = new URLSearchParams(searchParams.toString());
    if (e.target.value) {
      params.set('athlete', e.target.value);
    } else {
      params.delete('athlete');
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="mb-6 flex items-center gap-3">
      <label htmlFor="athlete-filter" className="text-sm font-medium text-gray-700">
        Athlete
      </label>
      <select
        id="athlete-filter"
        value={selectedId}
        onChange={handleChange}
        className="rounded-md border border-gray-300 px-3 py-2 text-sm"
      >
        <option value="">All athletes</option>
        {athletes.map((a) => (
          <option key={a.id} value={a.id}>
            {a.first_name} {a.last_name}
          </option>
        ))}
      </select>
    </div>
  );
}
