'use client';

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

type TrendPoint = {
  completedAt: string;
  rawScore: number;
};

type Props = {
  trends: Record<string, TrendPoint[]>;
};

export function PsychTrendChart({ trends }: Props) {
  const entries = Object.entries(trends);

  if (entries.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-6 py-10 text-center">
        <p className="text-sm font-semibold text-gray-500">Aún no hay resultados publicados</p>
        <p className="mt-1 text-xs text-gray-400">Cuando el equipo publique una interpretación, aparecerá aquí tu tendencia por subescala.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {entries.map(([subscale, points]) => (
        <div key={subscale} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold capitalize text-[#2D2D2D]">
            {subscale.replaceAll('_', ' ')}
          </h3>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={points}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f1f1" />
                <XAxis
                  dataKey="completedAt"
                  tickFormatter={(value) => new Date(value).toLocaleDateString('es-MX', { month: 'short', day: 'numeric' })}
                  tick={{ fontSize: 11 }}
                />
                <YAxis tick={{ fontSize: 11 }} width={28} />
                <Tooltip
                  labelFormatter={(value) => new Date(String(value)).toLocaleDateString('es-MX')}
                  formatter={(value) => [value, 'Puntaje']}
                />
                <Line type="monotone" dataKey="rawScore" stroke="#C0172C" strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      ))}
    </div>
  );
}
