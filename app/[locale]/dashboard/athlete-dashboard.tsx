/**
 * AthleteDashboard — Server Component
 *
 * Athlete-specific dashboard that mirrors the mobile app's home screen:
 *   1. Welcome header with name + discipline + role tag
 *   2. Mi Diagnóstico Inicial — progress bar + section breakdown
 *   3. Mi espacio — quick-access grid (Plans, Tickets, Calendar, Protocols)
 *
 * Rendered from dashboard/page.tsx when the logged-in user holds the
 * 'athlete' role.  All other roles see the existing KPI dashboard.
 */

import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { supabaseAdmin } from '@/lib/supabase-admin';
import {
  SECTION_KEYS,
  SECTION_LABELS,
  STATUS_LABELS,
  STATUS_COLORS,
  STATUS_DOT,
  getDisciplineLabel,
  type DiagnosticSectionKey,
  type DiagnosticStatus,
} from '@/lib/types/diagnostic';
import type { CurrentUser } from '@/lib/rbac/types';

// ---------------------------------------------------------------------------
// Per-section accent colours (mirrors SectionColors in mobile/constants/theme)
// ---------------------------------------------------------------------------

const SECTION_STYLES: Record<
  DiagnosticSectionKey,
  { border: string; bg: string; label: string }
> = {
  medico:       { border: 'border-blue-300',   bg: 'bg-blue-50',   label: 'text-blue-800'   },
  nutricion:    { border: 'border-green-300',  bg: 'bg-green-50',  label: 'text-green-800'  },
  psicologia:   { border: 'border-yellow-300', bg: 'bg-yellow-50', label: 'text-yellow-800' },
  entrenador:   { border: 'border-purple-300', bg: 'bg-purple-50', label: 'text-purple-800' },
  fisioterapia: { border: 'border-rose-300',   bg: 'bg-rose-50',   label: 'text-rose-800'   },
};

// ---------------------------------------------------------------------------
// Quick-access cards (Mi espacio) — titles/descs resolved from i18n at render
// ---------------------------------------------------------------------------

const QUICK_CARD_DEFS = [
  {
    href:        '/plans'     as const,
    emoji:       '📋',
    titleKey:    'plansTitle'   as const,
    descKey:     'plansDesc'    as const,
    card:        'border-blue-200  bg-blue-50  hover:bg-blue-100',
    titleColor:  'text-blue-800',
    descColor:   'text-blue-600',
  },
  {
    href:        '/tickets'   as const,
    emoji:       '🎫',
    titleKey:    'ticketsTitle' as const,
    descKey:     'ticketsDesc'  as const,
    card:        'border-teal-200  bg-teal-50  hover:bg-teal-100',
    titleColor:  'text-teal-800',
    descColor:   'text-teal-600',
  },
  {
    href:        '/calendar'  as const,
    emoji:       '📅',
    titleKey:    'calendarTitle' as const,
    descKey:     'calendarDesc'  as const,
    card:        'border-sky-200   bg-sky-50   hover:bg-sky-100',
    titleColor:  'text-sky-800',
    descColor:   'text-sky-600',
  },
  {
    href:        '/protocols' as const,
    emoji:       '📄',
    titleKey:    'protocolsTitle' as const,
    descKey:     'protocolsDesc'  as const,
    card:        'border-violet-200 bg-violet-50 hover:bg-violet-100',
    titleColor:  'text-violet-800',
    descColor:   'text-violet-600',
  },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type Props = { user: CurrentUser };

export default async function AthleteDashboard({ user }: Props) {
  const t = await getTranslations('athleteDashboard');
  const profileId = user.profile?.id ?? '';
  const email     = user.profile?.email ?? null;

  // ── 1. Resolve the athlete record linked to this profile ─────────────────
  // Tries profile_id first (explicit admin link), then falls back to email
  // (migration 018 — athletes.email = login email).
  const orClause = email
    ? `profile_id.eq.${profileId},email.eq.${email}`
    : `profile_id.eq.${profileId}`;

  const { data: athlete } = await supabaseAdmin
    .from('athletes')
    .select('id, first_name, last_name, discipline, status')
    .or(orClause)
    .maybeSingle();

  // ── 2. Load diagnostic data (only if athlete record exists) ──────────────
  const [{ data: diagRaw }, { data: sectionsRaw }] = athlete
    ? await Promise.all([
        supabaseAdmin
          .from('athlete_initial_diagnostic')
          .select('overall_status, completion_pct')
          .eq('athlete_id', athlete.id)
          .order('version', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabaseAdmin
          .from('athlete_diagnostic_sections')
          .select('section, status, completion_pct')
          .eq('athlete_id', athlete.id),
      ])
    : [{ data: null }, { data: null }];

  const diagnostic = diagRaw as {
    overall_status: string;
    completion_pct: number;
  } | null;

  const sections = (sectionsRaw ?? []) as {
    section: string;
    status:  string;
  }[];

  const sectionMap = Object.fromEntries(sections.map((s) => [s.section, s]));

  // ── 3. Derived display values ─────────────────────────────────────────────
  const fullName =
    user.profile
      ? `${user.profile.first_name} ${user.profile.last_name}`.trim()
      : t('roleTag');

  const diagStatus = (diagnostic?.overall_status ?? 'pendiente') as DiagnosticStatus;
  const diagPct    = diagnostic?.completion_pct ?? 0;

  const progressColor =
    diagStatus === 'completo'          ? 'bg-green-500' :
    diagStatus === 'requiere_atencion' ? 'bg-red-500'   :
    diagPct > 0                        ? 'bg-indigo-500' :
    'bg-gray-300';

  // ── 4. Render ─────────────────────────────────────────────────────────────
  return (
    <main className="p-8 max-w-4xl">

      {/* ── Welcome header ────────────────────────────────────────────────── */}
      <div className="mb-8">
        <p className="text-sm text-gray-400 mb-0.5">{t('welcome')}</p>
        <h1 className="text-3xl font-bold text-gray-900">{fullName}</h1>

        {athlete?.discipline && (
          <p className="text-sm text-gray-500 mt-1">
            {getDisciplineLabel(athlete.discipline)}
          </p>
        )}

        <span className="inline-flex items-center mt-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 ring-1 ring-indigo-200">
          {t('roleTag')}
        </span>
      </div>

      {/* ── Mi Diagnóstico Inicial ────────────────────────────────────────── */}
      <section className="mb-8">
        <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">
          {t('diagnosticTitle')}
        </h2>

        {diagnostic ? (
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            {/* Overall status + progress */}
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-gray-700">{t('diagnosticOverall')}</span>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[diagStatus]}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${STATUS_DOT[diagStatus]}`} />
                {STATUS_LABELS[diagStatus]}
              </span>
            </div>

            {/* Progress bar */}
            <div className="mb-4">
              <div className="flex justify-between text-xs text-gray-400 mb-1">
                <span>{t('diagnosticProgress')}</span>
                <span className="font-semibold text-indigo-700">{diagPct}%</span>
              </div>
              <div className="w-full h-2.5 rounded-full bg-gray-100 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${progressColor}`}
                  style={{ width: `${diagPct}%` }}
                />
              </div>
            </div>

            {/* Section rows */}
            <div className="space-y-2">
              {SECTION_KEYS.map((key) => {
                const sec       = sectionMap[key];
                const secStatus = (sec?.status ?? 'pendiente') as DiagnosticStatus;
                const style     = SECTION_STYLES[key];
                return (
                  <div
                    key={key}
                    className={`flex items-center justify-between rounded-lg border-l-4 px-3 py-2 ${style.border} ${style.bg}`}
                  >
                    <span className={`text-sm font-medium ${style.label}`}>
                      {SECTION_LABELS[key]}
                    </span>
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[secStatus]}`}
                    >
                      {STATUS_LABELS[secStatus]}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-gray-200 py-10 text-center bg-gray-50">
            <p className="text-sm font-medium text-gray-400">
              {t('diagnosticEmpty')}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {t('diagnosticEmptyDesc')}
            </p>
          </div>
        )}
      </section>

      {/* ── Mi espacio — quick-access grid ────────────────────────────────── */}
      <section>
        <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">
          {t('mySpace')}
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {QUICK_CARD_DEFS.map((c) => (
            <Link
              key={c.href}
              href={c.href}
              className={`rounded-xl border p-5 transition-colors ${c.card}`}
            >
              <div className="text-2xl mb-2">{c.emoji}</div>
              <h3 className={`text-sm font-bold mb-0.5 ${c.titleColor}`}>{t(c.titleKey)}</h3>
              <p className={`text-xs leading-snug ${c.descColor}`}>{t(c.descKey)}</p>
            </Link>
          ))}
        </div>
      </section>

    </main>
  );
}
