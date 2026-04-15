'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

type SessionPoint = {
  session_date: string;
  pain_score: number | null;
  health_score: number | null;
  adherence_score: number | null;
  weight_kg: number | null;
};

type TooltipEntry = {
  name?: string;
  value?: number;
  color?: string;
};

// ---------------------------------------------------------------------------
// Custom tooltip — shows only the metrics that have a value for that date
// ---------------------------------------------------------------------------

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  const entries = payload.filter((p) => p.value !== undefined && p.value !== null);
  if (entries.length === 0) return null;

  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-md text-xs">
      <p className="font-semibold text-gray-700 mb-1.5">{label}</p>
      {entries.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
          <span className="text-gray-600">{entry.name}:</span>
          <span className="font-medium text-gray-900">
            {entry.name === 'Weight (kg)'
              ? `${entry.value} kg`
              : `${entry.value}/10`}
          </span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SessionChart
// ---------------------------------------------------------------------------

export default function SessionChart({ sessions }: { sessions: SessionPoint[] }) {
  // Require at least 2 sessions to draw a meaningful line
  if (sessions.length < 2) return null;

  const data = [...sessions]
    .sort((a, b) => new Date(a.session_date).getTime() - new Date(b.session_date).getTime())
    .map((s) => ({
      date: new Date(s.session_date).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      }),
      pain:      s.pain_score      ?? undefined,
      health:    s.health_score    ?? undefined,
      adherence: s.adherence_score ?? undefined,
      weight:    s.weight_kg       ?? undefined,
    }));

  // Determine which series actually have data
  const hasPain      = data.some((d) => d.pain      !== undefined);
  const hasHealth    = data.some((d) => d.health    !== undefined);
  const hasAdherence = data.some((d) => d.adherence !== undefined);
  const hasWeight    = data.some((d) => d.weight    !== undefined);
  const hasAnyScore  = hasPain || hasHealth || hasAdherence;

  // Nothing to plot
  if (!hasAnyScore && !hasWeight) return null;

  return (
    <div className="mt-4 rounded-xl border border-gray-100 bg-gray-50 p-4">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">
        Progress Chart
      </p>
      <ResponsiveContainer width="100%" height={240}>
        <LineChart
          data={data}
          margin={{ top: 4, right: hasWeight ? 48 : 16, left: 0, bottom: 4 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} />

          {/* Left axis — 0 to 10 scores */}
          {hasAnyScore && (
            <YAxis
              yAxisId="score"
              domain={[0, 10]}
              ticks={[0, 2, 4, 6, 8, 10]}
              tick={{ fontSize: 11 }}
              label={{
                value: 'Score (/10)',
                angle: -90,
                position: 'insideLeft',
                offset: 14,
                style: { fontSize: 10, fill: '#9ca3af' },
              }}
            />
          )}

          {/* Right axis — weight in kg */}
          {hasWeight && (
            <YAxis
              yAxisId="weight"
              orientation="right"
              tick={{ fontSize: 11 }}
              label={{
                value: 'kg',
                angle: 90,
                position: 'insideRight',
                offset: 12,
                style: { fontSize: 10, fill: '#9ca3af' },
              }}
            />
          )}

          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />

          {/* Pain score — rose */}
          {hasPain && (
            <Line
              yAxisId="score"
              type="monotone"
              dataKey="pain"
              name="Pain"
              stroke="#f43f5e"
              strokeWidth={2}
              dot={{ r: 3, fill: '#f43f5e' }}
              activeDot={{ r: 5 }}
              connectNulls
            />
          )}

          {/* Health score — emerald */}
          {hasHealth && (
            <Line
              yAxisId="score"
              type="monotone"
              dataKey="health"
              name="Health"
              stroke="#10b981"
              strokeWidth={2}
              dot={{ r: 3, fill: '#10b981' }}
              activeDot={{ r: 5 }}
              connectNulls
            />
          )}

          {/* Adherence score — blue */}
          {hasAdherence && (
            <Line
              yAxisId="score"
              type="monotone"
              dataKey="adherence"
              name="Adherence"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={{ r: 3, fill: '#3b82f6' }}
              activeDot={{ r: 5 }}
              connectNulls
            />
          )}

          {/* Weight — amber, right axis */}
          {hasWeight && (
            <Line
              yAxisId="weight"
              type="monotone"
              dataKey="weight"
              name="Weight (kg)"
              stroke="#f59e0b"
              strokeWidth={2}
              strokeDasharray="5 3"
              dot={{ r: 3, fill: '#f59e0b' }}
              activeDot={{ r: 5 }}
              connectNulls
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
