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

type CheckinPoint = {
  checkin_date: string;
  weight_kg: number | null;
  body_fat_percent: number | null;
};

export default function CheckinChart({ checkins }: { checkins: CheckinPoint[] }) {
  const data = [...checkins]
    .sort((a, b) => new Date(a.checkin_date).getTime() - new Date(b.checkin_date).getTime())
    .map((c) => ({
      date: new Date(c.checkin_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      weight: c.weight_kg ?? undefined,
      bodyFat: c.body_fat_percent ?? undefined,
    }));

  if (data.length === 0) return null;

  return (
    <div className="rounded-lg border border-gray-200 p-5 mb-6">
      <h2 className="text-sm font-semibold text-gray-700 mb-4">Check-in Trends</h2>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data} margin={{ top: 4, right: 24, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} />
          {/* Left axis: body composition */}
          <YAxis
            yAxisId="body"
            tick={{ fontSize: 11 }}
            label={{ value: 'kg / %', angle: -90, position: 'insideLeft', offset: 10, style: { fontSize: 10, fill: '#9ca3af' } }}
          />
          <Tooltip
            contentStyle={{ fontSize: 12 }}
            formatter={(value: unknown, name: unknown) => {
              if (name === 'Weight (kg)') return [`${value} kg`, name];
              if (name === 'Body fat (%)') return [`${value}%`, name];
              return [`${value}`, `${name}`];
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line
            yAxisId="body"
            type="monotone"
            dataKey="weight"
            name="Weight (kg)"
            stroke="#2563eb"
            strokeWidth={2}
            dot={{ r: 3 }}
            connectNulls
          />
          <Line
            yAxisId="body"
            type="monotone"
            dataKey="bodyFat"
            name="Body fat (%)"
            stroke="#16a34a"
            strokeWidth={2}
            dot={{ r: 3 }}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
