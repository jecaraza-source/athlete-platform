'use client';

import { useState } from 'react';
import { PlanCard } from './plan-card';
import type { Plan, DisciplineOption } from '@/lib/plans/actions';
import { getDisciplineLabel } from '@/lib/types/diagnostic';

type SortKey = 'newest' | 'oldest' | 'athlete' | 'discipline' | 'title';

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'newest',  label: 'Más reciente' },
  { value: 'oldest',  label: 'Más antiguo' },
  { value: 'athlete', label: 'Atleta (A→Z)' },
  { value: 'discipline', label: 'Disciplina (A→Z)' },
  { value: 'title',   label: 'Título (A→Z)' },
];

function firstAthleteSort(plan: Plan): string {
  const first = plan.athlete_plans?.[0]?.athletes;
  if (!first) return '\uFFFF'; // no athlete → sort to end
  return `${first.last_name} ${first.first_name}`.toLowerCase();
}

function planDisciplineKey(plan: Plan): string | null {
  if (plan.discipline) return plan.discipline;
  const disciplines = (plan.athlete_plans ?? [])
    .map((assignment) => assignment.athletes?.discipline)
    .filter((discipline): discipline is string => Boolean(discipline))
    .sort((a, b) => a.localeCompare(b, 'es'));
  if (disciplines.length === 1) return disciplines[0];
  return disciplines.length > 1 ? 'multidisciplinary' : null;
}

function firstDisciplineSort(plan: Plan): string {
  return planDisciplineKey(plan)?.toLocaleLowerCase('es') ?? '\uFFFF'; // no discipline → sort to end
}

function disciplineLabel(key: string): string {
  return key === 'multidisciplinary' ? 'Multidisciplinario' : getDisciplineLabel(key);
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
    case 'discipline':
      return s.sort((a, b) => {
        const disciplineComparison = firstDisciplineSort(a).localeCompare(firstDisciplineSort(b), 'es');
        return disciplineComparison || firstAthleteSort(a).localeCompare(firstAthleteSort(b), 'es');
      });
    case 'title':
      return s.sort((a, b) => a.title.localeCompare(b.title, 'es'));
  }
}

export function PlansList({
  plans,
  signedUrls,
  readOnly = false,
  disciplines,
}: {
  plans:        Plan[];
  signedUrls:   Record<string, string | null>;
  readOnly?:    boolean;
  disciplines?: DisciplineOption[];
}) {
  const [sortKey, setSortKey] = useState<SortKey>('newest');
  const [selectedDiscipline, setSelectedDiscipline] = useState('');
  const availableDisciplines = [...new Set(
    plans
      .map(planDisciplineKey)
      .filter((discipline): discipline is string => Boolean(discipline)),
  )].sort((a, b) => disciplineLabel(a).localeCompare(disciplineLabel(b), 'es'));
  const visiblePlans = selectedDiscipline
    ? plans.filter((plan) => planDisciplineKey(plan) === selectedDiscipline)
    : plans;
  const sorted = sortPlans(visiblePlans, sortKey);

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
          {availableDisciplines.length > 1 && (
            <>
              <span className="ml-2 text-xs text-gray-500">Filtrar disciplina</span>
              <select
                value={selectedDiscipline}
                onChange={(e) => setSelectedDiscipline(e.target.value)}
                className="rounded border border-gray-200 px-2 py-0.5 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-400"
              >
                <option value="">Todas las disciplinas</option>
                {availableDisciplines.map((discipline) => (
                  <option key={discipline} value={discipline}>
                    {disciplineLabel(discipline)}
                  </option>
                ))}
              </select>
            </>
          )}
        </div>
      )}
      <div className="space-y-4">
        {sorted.map((plan) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            signedUrl={signedUrls[plan.id] ?? null}
            readOnly={readOnly}
            disciplines={disciplines}
          />
        ))}
      </div>
    </div>
  );
}
