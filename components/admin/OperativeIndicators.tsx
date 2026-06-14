'use client';
import React from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import type { HeatmapCell, SpecialistLoad } from '@/lib/types/admin';

const DAY_LABELS  = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do'];
const HOUR_LABELS = Array.from({ length: 16 }, (_, i) => `${7 + i}h`);

interface Props {
  attendanceData: { name: string; value: number; color: string }[];
  attendanceRate: number;
  heatmap: HeatmapCell[];
  specialists: SpecialistLoad[];
}

export function OperativeIndicators({ attendanceData, attendanceRate, heatmap, specialists }: Props) {
  const maxCount = Math.max(...heatmap.map(c => c.count), 1);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Donut — Tasa de asistencia */}
      <div className={`bg-[#1A1D27] rounded-xl border p-5 ${attendanceRate < 70 ? 'border-red-500/40' : 'border-[#2A2D3A]'}`}>
        <h3 className="text-[#F1F5F9] font-semibold text-sm mb-1">Tasa de asistencia</h3>
        {attendanceRate < 70 && (
          <p className="text-red-400 text-xs mb-3">⚠️ Por debajo del umbral (70%)</p>
        )}
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={attendanceData} dataKey="value" cx="50%" cy="50%"
                   innerRadius={55} outerRadius={80}>
                {attendanceData.map((e, i) => <Cell key={i} fill={e.color} />)}
              </Pie>
              <Tooltip
                contentStyle={{ background: '#1A1D27', border: '1px solid #2A2D3A', borderRadius: 8 }}
                itemStyle={{ color: '#94A3B8', fontSize: 11 }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="grid grid-cols-2 gap-1 mt-2">
          {attendanceData.map(d => (
            <div key={d.name} className="flex items-center gap-1.5 text-xs">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: d.color }} />
              <span className="text-[#94A3B8] truncate">{d.name}</span>
              <span className="ml-auto text-[#F1F5F9] font-medium">{d.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Heatmap — Demanda por hora */}
      <div className="bg-[#1A1D27] rounded-xl border border-[#2A2D3A] p-5 overflow-hidden">
        <h3 className="text-[#F1F5F9] font-semibold text-sm mb-4">Demanda por hora</h3>
        <div className="overflow-x-auto">
          <div className="grid gap-px" style={{ gridTemplateColumns: '28px repeat(7, 1fr)' }}>
            {/* Header días */}
            <div />
            {DAY_LABELS.map(d => (
              <div key={d} className="text-center text-[10px] text-[#6B7280] pb-1">{d}</div>
            ))}
            {/* Filas de horas */}
            {HOUR_LABELS.map((hl, hi) => (
              <React.Fragment key={hi}>
                <div className="text-[10px] text-[#6B7280] flex items-center justify-end pr-1">
                  {hl}
                </div>
                {Array.from({ length: 7 }, (_, di) => {
                  const cell      = heatmap.find(c => c.day === di && c.hour === 7 + hi);
                  const intensity = cell ? cell.count / maxCount : 0;
                  const opacity   = Math.max(0.05, intensity);
                  return (
                    <div key={`${hi}-${di}`}
                      title={cell?.count ? `${cell.count} citas` : 'Sin citas'}
                      className="h-4 rounded-sm cursor-default"
                      style={{ background: `rgba(99,102,241,${opacity})` }}
                    />
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between mt-3">
          <span className="text-[10px] text-[#6B7280]">Menos</span>
          <div className="flex gap-0.5">
            {[0.05, 0.2, 0.4, 0.65, 1].map(o => (
              <div key={o} className="w-4 h-3 rounded-sm" style={{ background: `rgba(99,102,241,${o})` }} />
            ))}
          </div>
          <span className="text-[10px] text-[#6B7280]">Más</span>
        </div>
      </div>

      {/* Ranking de especialistas */}
      <div className="bg-[#1A1D27] rounded-xl border border-[#2A2D3A] p-5">
        <h3 className="text-[#F1F5F9] font-semibold text-sm mb-4">Carga por especialista</h3>
        <div className="space-y-4">
          {specialists.map((sp, i) => {
            const pct      = sp.utilizationPercent;
            const barColor = pct > 90 ? '#EF4444' : pct > 75 ? '#F59E0B' : '#6366F1';
            return (
              <div key={sp.id}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[#6B7280] w-4">{i + 1}</span>
                    <span className="text-xs text-[#F1F5F9] truncate max-w-32">{sp.full_name}</span>
                  </div>
                  <span className={`text-xs font-medium ${pct > 90 ? 'text-red-400' : pct > 75 ? 'text-amber-400' : 'text-[#94A3B8]'}`}>
                    {sp.appointmentCount}/{sp.capacity}
                  </span>
                </div>
                <div className="h-1.5 bg-[#2A2D3A] rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all"
                    style={{ width: `${Math.min(100, pct)}%`, background: barColor }} />
                </div>
              </div>
            );
          })}
          {specialists.length === 0 && (
            <p className="text-[#6B7280] text-xs text-center py-4">Sin datos del período</p>
          )}
        </div>
      </div>
    </div>
  );
}
