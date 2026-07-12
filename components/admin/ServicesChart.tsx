'use client';
import { useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import type { ServiceStat } from '@/lib/types/admin';

const COLORS = ['#6366F1', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4'];

interface Props { data: ServiceStat[]; }

export function ServicesChart({ data }: Props) {
  const [view, setView] = useState<'bar' | 'pie'>('bar');

  return (
    <div className="bg-[#1A1D27] rounded-xl border border-[#2A2D3A] p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-[#F1F5F9] font-semibold text-sm">Servicios utilizados</h2>
          <p className="text-[#94A3B8] text-xs mt-0.5">Distribución por tipo de consulta</p>
        </div>
        <div className="flex gap-1 bg-[#0F1117] rounded-lg p-1">
          {(['bar', 'pie'] as const).map(v => (
            <button key={v} onClick={() => setView(v)}
              className={`px-3 py-1 rounded text-xs transition-all ${
                view === v ? 'bg-indigo-600 text-white' : 'text-[#94A3B8] hover:text-[#F1F5F9]'
              }`}>
              {v === 'bar' ? 'Barras' : 'Pastel'}
            </button>
          ))}
        </div>
      </div>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          {view === 'bar' ? (
            <BarChart data={data} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <XAxis dataKey="label" tick={{ fill: '#94A3B8', fontSize: 10 }}
                     tickFormatter={(l: string) => l.split(' ')[0]} />
              <YAxis tick={{ fill: '#94A3B8', fontSize: 10 }} />
              <Tooltip
                contentStyle={{ background: '#1A1D27', border: '1px solid #2A2D3A', borderRadius: 8 }}
                labelStyle={{ color: '#F1F5F9', fontSize: 12 }}
                itemStyle={{ color: '#94A3B8', fontSize: 11 }}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={(v, _name, props: any) => [
                  `${String(v)} citas (${props.payload?.percentage ?? 0}%)`, '',
                ]}
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          ) : (
            <PieChart>
              <Pie data={data} dataKey="count" nameKey="label"
                   cx="50%" cy="50%" outerRadius={90}
                   // eslint-disable-next-line @typescript-eslint/no-explicit-any
                   label={({ label, percentage }: any) => `${String(label).split(' ')[0]} ${percentage}%`}
                   labelLine={false}>
                {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Legend formatter={(v) => <span style={{ color: '#94A3B8', fontSize: 11 }}>{v}</span>} />
            </PieChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Tabla de tendencias */}
      <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-2">
        {data.map((s, i) => (
          <div key={s.service_type} className="flex items-center gap-2 text-xs">
            <span className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ background: COLORS[i % COLORS.length] }} />
            <span className="text-[#94A3B8] truncate">{s.label}</span>
            <span className={`ml-auto ${s.trend === 'up' ? 'text-emerald-400' : s.trend === 'down' ? 'text-red-400' : 'text-[#94A3B8]'}`}>
              {s.trend === 'up' ? '↑' : s.trend === 'down' ? '↓' : '—'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
