'use client';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import type { RealtimeAlert } from '@/lib/types/admin';

const ALERT_CONFIG: Record<RealtimeAlert['type'], { icon: string; label: string; btnLabel: string }> = {
  unconfirmed:        { icon: '🔴', label: 'Sin confirmar <24h',   btnLabel: 'Ver cita' },
  consecutive_noshow: { icon: '🟡', label: 'No Show consecutivos', btnLabel: 'Ver historial' },
  new_athlete:        { icon: '🟢', label: 'Nuevo atleta',         btnLabel: 'Ver perfil' },
  pending_reschedule: { icon: '🔵', label: 'Reagendamiento',       btnLabel: 'Ver cita' },
};

interface Props {
  alerts: RealtimeAlert[];
  onDismiss: (id: string) => void;
}

export function AlertsPanel({ alerts, onDismiss }: Props) {
  return (
    <div className="bg-[#1A1D27] rounded-xl border border-[#2A2D3A] p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[#F1F5F9] font-semibold text-sm">Alertas en tiempo real</h3>
        {alerts.length > 0 && (
          <span className="px-2 py-0.5 rounded-full bg-red-500/20 border border-red-500/30 text-red-300 text-xs font-medium">
            {alerts.length}
          </span>
        )}
      </div>

      {alerts.length === 0 ? (
        <div className="text-center py-8">
          <span className="text-2xl">✅</span>
          <p className="text-xs text-[#6B7280] mt-2">Sin alertas activas</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {alerts.map(alert => {
            const cfg = ALERT_CONFIG[alert.type];
            return (
              <div key={alert.id}
                className="flex items-start gap-3 p-3 rounded-lg bg-[#0F1117] border border-[#2A2D3A] hover:border-indigo-500/30 transition-colors">
                <span className="text-lg flex-shrink-0">{cfg.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-[#F1F5F9]">{cfg.label}</p>
                  <p className="text-xs text-[#94A3B8] mt-0.5 truncate">{alert.message}</p>
                  <p className="text-[10px] text-[#6B7280] mt-1">
                    {formatDistanceToNow(new Date(alert.createdAt), { addSuffix: true, locale: es })}
                  </p>
                </div>
                <div className="flex flex-col gap-1 flex-shrink-0">
                  {alert.appointmentId && (
                    <a href={`/medical/appointments/${alert.appointmentId}`}
                      className="text-[10px] text-indigo-400 hover:text-indigo-300 whitespace-nowrap transition-colors">
                      {cfg.btnLabel} →
                    </a>
                  )}
                  {alert.athleteId && !alert.appointmentId && (
                    <a href={`/admin/athletes/${alert.athleteId}`}
                      className="text-[10px] text-indigo-400 hover:text-indigo-300 whitespace-nowrap transition-colors">
                      {cfg.btnLabel} →
                    </a>
                  )}
                  <button onClick={() => onDismiss(alert.id)}
                    className="text-[10px] text-[#6B7280] hover:text-red-400 transition-colors text-left">
                    Descartar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
