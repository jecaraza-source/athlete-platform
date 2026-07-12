'use client';

import Link    from 'next/link';
import { useState } from 'react';
import { toggleAutomationRule, deleteAutomationRule } from '../actions';

type Rule = {
  id:                string;
  name:              string;
  description:       string | null;
  event_key:         string;
  trigger_event:     string;
  delay_minutes:     number;
  filter_statuses:   string[] | null;
  filter_priorities: string[] | null;
  is_active:         boolean;
  updated_at:        string;
};

const STATUS_LABELS: Record<string, string> = {
  open:        'Abierto',
  in_progress: 'En progreso',
  resolved:    'Resuelto',
  closed:      'Cerrado',
};
const PRIORITY_LABELS: Record<string, string> = {
  low: 'Baja', medium: 'Media', high: 'Alta', urgent: 'Urgente',
};

function formatDelay(minutes: number): string {
  if (minutes === 0)    return 'Inmediato';
  if (minutes < 60)     return `${minutes} min`;
  if (minutes < 1440)   return `${Math.round(minutes / 60)} h`;
  return `${Math.round(minutes / 1440)} días`;
}

export default function RuleCard({
  rule,
  triggerLabel,
  matchingCount,
}: {
  rule:          Rule;
  triggerLabel:  string;
  matchingCount: number;   // -1 = not applicable (event-based)
}) {
  const [active,  setActive]  = useState(rule.is_active);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  async function handleToggle() {
    setLoading(true); setError(null);
    const newState = !active;
    const res = await toggleAutomationRule(rule.id, newState);
    setLoading(false);
    if (res.error) setError(res.error);
    else setActive(newState);
  }

  async function handleDelete() {
    if (!confirm(`¿Eliminar la regla "${rule.name}"? Esta acción no se puede deshacer.`)) return;
    setLoading(true); setError(null);
    const res = await deleteAutomationRule(rule.id);
    setLoading(false);
    if (res.error) setError(res.error);
    // On success the page revalidates and the card disappears
  }

  return (
    <div className={`rounded-lg border transition-colors ${
      active ? 'border-amber-200 bg-amber-50' : 'border-gray-200 bg-gray-50'
    }`}>
      {/* ── Header row ─────────────────────────────────────────────── */}
      <div className="flex items-start gap-4 p-4">

        {/* Active toggle */}
        <button
          type="button"
          onClick={handleToggle}
          disabled={loading}
          title={active ? 'Desactivar regla' : 'Activar regla'}
          className={`mt-0.5 relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
            active ? 'bg-amber-500' : 'bg-gray-300'
          }`}
        >
          <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
            active ? 'translate-x-[18px]' : 'translate-x-[2px]'
          }`} />
        </button>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm text-gray-800">{rule.name}</span>
            {!active && (
              <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs text-gray-500">
                Inactiva
              </span>
            )}
          </div>
          {rule.description && (
            <p className="text-xs text-gray-500 mt-0.5">{rule.description}</p>
          )}

          {/* Inline meta chips */}
          <div className="flex flex-wrap gap-2 mt-2">
            <Chip color="amber">
              ⚡ {triggerLabel}
            </Chip>
            <Chip color="gray">
              🕐 {formatDelay(rule.delay_minutes)}
            </Chip>
            <Chip color="gray" mono>
              {rule.event_key}
            </Chip>
            {matchingCount >= 0 && (
              <Chip color={matchingCount > 0 ? 'rose' : 'green'}>
                {matchingCount > 0
                  ? `${matchingCount} ticket${matchingCount === 1 ? '' : 's'} afectado${matchingCount === 1 ? '' : 's'}`
                  : '0 tickets afectados'}
              </Chip>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-gray-400 hover:text-gray-700"
            title="Ver configuración"
          >
            {expanded ? '▲' : '▼'}
          </button>
          <Link
            href={`/admin/notificaciones/tickets/reglas/${rule.id}`}
            className="text-xs text-amber-600 hover:underline"
          >
            Editar
          </Link>
          <button
            type="button"
            onClick={handleDelete}
            disabled={loading}
            className="text-xs text-red-500 hover:underline disabled:opacity-50"
          >
            Eliminar
          </button>
        </div>
      </div>

      {/* ── Expanded config ─────────────────────────────────────────── */}
      {expanded && (
        <div className="border-t border-amber-100 px-4 py-3 grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
          <ConfigField label="Evento plantilla" value={rule.event_key} mono />
          <ConfigField label="Disparo"           value={triggerLabel} />
          <ConfigField label="Demora"            value={formatDelay(rule.delay_minutes)} />
          <ConfigField
            label="Estados filtro"
            value={rule.filter_statuses
              ? rule.filter_statuses.map((s) => STATUS_LABELS[s] ?? s).join(', ')
              : 'Cualquiera'}
          />
          <ConfigField
            label="Prioridades filtro"
            value={rule.filter_priorities
              ? rule.filter_priorities.map((p) => PRIORITY_LABELS[p] ?? p).join(', ')
              : 'Cualquiera'}
          />
          <ConfigField
            label="Actualizada"
            value={new Date(rule.updated_at).toLocaleDateString('es-MX')}
          />
        </div>
      )}

      {error && (
        <p className="px-4 pb-3 text-xs text-red-600">{error}</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Small presentational helpers
// ---------------------------------------------------------------------------

function Chip({
  children,
  color,
  mono,
}: {
  children: React.ReactNode;
  color:    'amber' | 'gray' | 'rose' | 'green';
  mono?:    boolean;
}) {
  const colors = {
    amber: 'bg-amber-100 text-amber-700',
    gray:  'bg-gray-100  text-gray-600',
    rose:  'bg-rose-100  text-rose-700',
    green: 'bg-green-100 text-green-700',
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ${colors[color]} ${mono ? 'font-mono' : ''}`}>
      {children}
    </span>
  );
}

function ConfigField({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-gray-400 uppercase tracking-wider text-[10px] font-semibold mb-0.5">{label}</p>
      <p className={`text-gray-700 ${mono ? 'font-mono' : ''}`}>{value}</p>
    </div>
  );
}
