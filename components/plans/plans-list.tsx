'use client';

import { useState } from 'react';
import { PlanCard } from './plan-card';
import type { Plan } from '@/lib/plans/actions';

type SortKey = 'newest' | 'oldest' | 'athlete' | 'title';

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'newest',  label: 'Más reciente' },
  { value: 'oldest',  label: 'Más antiguo' },
  { value: 'athlete', label: 'Atleta (A→Z)' },
  { value: 'title',   label: 'Título (A→Z)' },
];

function firstAthleteSort(plan: Plan): string {
  const first = plan.athlete_plans?.[0]?.athletes;
  if (!first) return '\uFFFF'; // no athlete → sort to end
  return `${first.last_name} ${first.first_name}`.toLowerCase();
}

function sortPlans(plans: Plan[], key: SortKey): Plan[] {
  const s = [...plans];
  switch (key) {
    case 'newest':
      return s.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    case 'oldest':
      return s.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    case 'athlete':
      return s.sort((a, b) => firstAthleteSort(a).localeCompare(firstAthleteSort(b), 'es'));
    case 'title':
      return s.sort((a, b) => a.title.localeCompare(b.title, 'es'));
  }
}

export function PlansList({
  plans,
  signedUrls,
  readOnly = false,
}: {
  plans: Plan[];
  signedUrls: Record<string, string | null>;
  readOnly?: boolean;
}) {
  const [sortKey, setSortKey] = useState<SortKey>('newest');
  const sorted = sortPlans(plans, sortKey);

  return (
    <div>
      {plans.length > 1 && (
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xs text-gray-500">Ordenar por</span>
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            className="rounded border border-gray-200 px-2 py-0.5 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-400"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="space-y-4">
        {sorted.map((plan) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            signedUrl={signedUrls[plan.id] ?? null}
            readOnly={readOnly}
          />
        ))}
      </div>
    </div>
  );
}
