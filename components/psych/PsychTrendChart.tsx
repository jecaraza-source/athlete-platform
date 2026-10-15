'use client';

import { useLocale, useTranslations } from 'next-intl';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { psychDateLocale, psychLabel } from '@/lib/psych/labels';

type TrendPoint = {
  completedAt: string;
  rawScore: number;
};

type Props = {
  trends: Record<string, TrendPoint[]>;
};

export function PsychTrendChart({ trends }: Props) {
  const t = useTranslations('psych.trend');
  const tc = useTranslations('psych.common');
  const dateLocale = psychDateLocale(useLocale());
  const entries = Object.entries(trends);

  if (entries.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-6 py-10 text-center">
        <p className="text-sm font-semibold text-gray-500">{t('emptyTitle')}</p>
        <p className="mt-1 text-xs text-gray-400">{t('emptyDescription')}</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {entries.map(([subscale, points]) => (
        <div key={subscale} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold capitalize text-[#2D2D2D]">
            {psychLabel(tc, 'subscale', subscale)}
          </h3>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={points}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f1f1" />
                <XAxis
                  dataKey="completedAt"
                  tickFormatter={(value) => new Date(value).toLocaleDateString(dateLocale, { month: 'short', day: 'numeric' })}
                  tick={{ fontSize: 11 }}
                />
                <YAxis tick={{ fontSize: 11 }} width={28} />
                <Tooltip
                  labelFormatter={(value) => new Date(String(value)).toLocaleDateString(dateLocale)}
                  formatter={(value) => [value, t('score')]}
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
