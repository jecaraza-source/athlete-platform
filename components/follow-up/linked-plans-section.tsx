'use client';

import { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';

export type LinkedPlan = {
  id: string;
  title: string;
  created_at: string;
  is_published: boolean;
  athlete_plans: {
    athlete_id: string;
    athletes: { first_name: string; last_name: string } | null;
  }[];
};

const NEW_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000;

function isNew(createdAt: string): boolean {
  return Date.now() - new Date(createdAt).getTime() < NEW_THRESHOLD_MS;
}

/**
 * Renders a collapsible panel showing plans from the Plans module that are
 * relevant to this follow-up discipline. Provides a "Dar seguimiento" link
 * per athlete that applies the athlete filter on the current follow-up page.
 *
 * @param plans         Plans of the matching type, with athlete assignments.
 * @param followUpPath  The current follow-up path, e.g. "/follow-up/medical".
 *                      Used to build the ?athlete= filter link.
 */
/** What to create per follow-up area (used in the confirmation dialog). */
const CONFIRM_SUBJECT: Record<string, string> = {
  '/follow-up/training':   'sesión de entrenamiento',
  '/follow-up/medical':    'caso médico',
  '/follow-up/physio':     'caso de fisioterapia',
  '/follow-up/psychology': 'caso de psicología',
  '/follow-up/nutrition':  'plan nutricional',
};

/** URL param key that triggers the creation form on each page. */
const OPEN_PARAM: Record<string, string> = {
  '/follow-up/training':   'new_session',
  '/follow-up/medical':    'new_case',
  '/follow-up/physio':     'new_case',
  '/follow-up/psychology': 'new_case',
  '/follow-up/nutrition':  'new_plan',
};

export default function LinkedPlansSection({
  plans,
  followUpPath,
  showConfirm = false,
}: {
  plans: LinkedPlan[];
  followUpPath: string;
  /** When true the CTA shows a confirmation dialog before navigating. */
  showConfirm?: boolean;
}) {
  const [open, setOpen] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  function handleConfirmCta(athleteId: string, athleteName: string | null, planTitle: string) {
    const who     = athleteName ?? 'este atleta';
    const subject = CONFIRM_SUBJECT[followUpPath] ?? 'seguimiento';
    const confirmed = window.confirm(
      `¿Deseas crear un nuevo ${subject} para ${who} en relación al plan "${planTitle}"?`
    );
    if (!confirmed) return;

    // Navigate to the same page with athlete filter + the section-specific form-open trigger.
    const openKey = OPEN_PARAM[followUpPath] ?? 'new_case';
    router.push(
      `${pathname}?athlete=${athleteId}&${openKey}=1&plan_title=${encodeURIComponent(planTitle)}`
    );
    // Collapse the panel so the creation form below is immediately visible.
    setOpen(false);
  }

  if (plans.length === 0) return null;

  // Flatten to one row per (plan × athlete assignment)
  type Row = {
    planId: string;
    title: string;
    createdAt: string;
    isPublished: boolean;
    athleteId: string | null;
    athleteName: string | null;
    isCollective: boolean;
  };

  const rows: Row[] = plans.flatMap((p): Row[] => {
    const isCollective = p.athlete_plans.length > 1;

    if (p.athlete_plans.length === 0) {
      return [{ planId: p.id, title: p.title, createdAt: p.created_at,
        isPublished: p.is_published, athleteId: null, athleteName: null, isCollective: false }];
    }

    return p.athlete_plans.map((ap): Row => ({
      planId: p.id,
      title: p.title,
      createdAt: p.created_at,
      isPublished: p.is_published,
      athleteId: ap.athlete_id,
      athleteName: ap.athletes
        ? `${ap.athletes.first_name} ${ap.athletes.last_name}`
        : null,
      isCollective,
    }));
  });

  return (
    <div className="mb-6 rounded-xl border border-indigo-100 bg-indigo-50/60">
      {/* Header */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-indigo-800">
          📋 Planes asignados
          <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-600">
            {plans.length}
          </span>
        </span>
        <svg
          className={`h-4 w-4 text-indigo-400 transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-2">
          {rows.map((row, i) => (
            <div
              key={`${row.planId}-${row.athleteId ?? i}`}
              className="flex items-center justify-between gap-3 rounded-lg border border-indigo-100 bg-white px-3 py-2.5"
            >
              {/* Left: plan info */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-sm font-medium text-gray-800 truncate">
                    {row.title}
                  </span>
                  {isNew(row.createdAt) && (
                    <span className="inline-flex items-center rounded-full bg-emerald-500 px-1.5 py-0.5 text-[10px] font-bold text-white leading-none">
                      Nuevo
                    </span>
                  )}
                  {!row.isPublished && (
                    <span className="inline-flex items-center rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500 leading-none">
                      Borrador
                    </span>
                  )}
                </div>
                {row.athleteName && (
                  <p className="mt-0.5 text-xs text-gray-500 flex items-center gap-1">
                    <span>👤</span>
                    <span>{row.athleteName}</span>
                    {row.isCollective && (
                      <span className="text-indigo-400 font-medium">· Colectivo</span>
                    )}
                  </p>
                )}
                {!row.athleteName && (
                  <p className="mt-0.5 text-xs text-gray-400">Sin atleta asignado</p>
                )}
              </div>

              {/* Right: CTA */}
              {row.athleteId ? (
                <button
                  type="button"
                  onClick={() =>
                    showConfirm
                      ? handleConfirmCta(row.athleteId!, row.athleteName, row.title)
                      : router.push(`${pathname}?athlete=${row.athleteId}`)
                  }
                  className="shrink-0 inline-flex items-center gap-1 rounded-md bg-indigo-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 transition-colors whitespace-nowrap"
                >
                  Dar seguimiento →
                </button>
              ) : (
                <span className="shrink-0 text-xs text-gray-400 italic">Sin atleta</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
