'use client';
import type { KpiSet } from '@/lib/types/admin';

interface KpiCardProps {
  title: string;
  value: string;
  trend: 'up' | 'down' | 'neutral';
  trendPercent: number;
  trendLabel: string;
  icon: string;
  alert?: boolean;
  onDetail?: () => void;
}

function KpiCard({ title, value, trend, trendPercent, trendLabel, icon, alert, onDetail }: KpiCardProps) {
  const trendColor = trend === 'up' ? 'text-emerald-400' : trend === 'down' ? 'text-red-400' : 'text-[#94A3B8]';
  const trendSign  = trend === 'up' ? '↑' : trend === 'down' ? '↓' : '—';

  return (
    <div className={`bg-[#1A1D27] rounded-xl p-5 border transition-all hover:border-indigo-500/40 ${
      alert ? 'border-red-500/50' : 'border-[#2A2D3A]'
    }`}>
      <div className="flex items-start justify-between mb-3">
        <span className="text-2xl">{icon}</span>
        {onDetail && (
          <button onClick={onDetail} className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
            Ver detalle →
          </button>
        )}
      </div>
      <div className="text-3xl font-bold text-[#F1F5F9] mb-1">{value}</div>
      <div className="text-xs text-[#94A3B8] mb-2">{title}</div>
      <div className={`text-xs font-medium ${trendColor}`}>
        {trendSign} {trendPercent > 0 ? `${trendPercent}%` : ''} {trendLabel}
      </div>
    </div>
  );
}

interface Props {
  kpis: KpiSet;
  periodLabel: string;
  onOpenDrawer: () => void;
}

export function KpiCards({ kpis, periodLabel: _periodLabel, onOpenDrawer }: Props) {
  const prevLabel = 'vs período anterior';

  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
      {/* Fila 1 */}
      <KpiCard
        title="Total de citas"
        value={kpis.totalAppointments.value.toString()}
        trend={kpis.totalAppointments.trend}
        trendPercent={kpis.totalAppointments.trendPercent}
        trendLabel={prevLabel}
        icon="📅"
        onDetail={onOpenDrawer}
      />
      <KpiCard
        title="Citas programadas"
        value={kpis.scheduledAppointments.value.toString()}
        trend="neutral"
        trendPercent={0}
        trendLabel="pendientes por atender"
        icon="🕒"
        alert={kpis.scheduledAppointments.value === 0}
      />
      <KpiCard
        title="Tasa de asistencia"
        value={`${kpis.attendanceRate.value}%`}
        trend={kpis.attendanceRate.trend}
        trendPercent={kpis.attendanceRate.trendPercent}
        trendLabel={prevLabel}
        icon="✅"
        alert={kpis.attendanceRate.value < 70}
      />

      {/* Fila 2 */}
      <KpiCard
        title="No asistencias"
        value={kpis.noShowAppointments.value.toString()}
        trend={kpis.noShowAppointments.trend}
        trendPercent={kpis.noShowAppointments.trendPercent}
        trendLabel={prevLabel}
        icon="❌"
        alert={kpis.noShowAppointments.value > 0}
      />
      <KpiCard
        title="Atletas activos"
        value={kpis.activeAthletes.value.toString()}
        trend="neutral"
        trendPercent={0}
        trendLabel="total acumulado"
        icon="🏃"
      />
      <KpiCard
        title="Nuevos registros"
        value={kpis.newRegistrations.value.toString()}
        trend={kpis.newRegistrations.trend}
        trendPercent={kpis.newRegistrations.trendPercent}
        trendLabel={prevLabel}
        icon="👤"
      />
    </div>
  );
}
