'use client';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Appointment } from '@/lib/types/admin';

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  confirmed:   { label: 'Confirmada', className: 'bg-blue-500/20  text-blue-300  border-blue-500/30' },
  show:        { label: 'Atendió',    className: 'bg-green-500/20 text-green-300 border-green-500/30' },
  no_show:     { label: 'No Atendió', className: 'bg-red-500/20   text-red-300   border-red-500/30' },
  rescheduled: { label: 'Reagendada', className: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
  cancelled:   { label: 'Cancelada',  className: 'bg-gray-500/20  text-gray-300  border-gray-500/30' },
};

const SERVICE_ICONS: Record<string, string> = {
  medico: '👨‍⚕️', nutricion: '🥗', fisioterapia: '🏃',
  psicologia: '🧠', evaluacion: '📊', entrenamiento: '💪',
};

interface Props {
  data: Appointment[];
  onOpenDrawer: () => void;
}

export function AppointmentsTable({ data, onOpenDrawer }: Props) {
  return (
    <div className="bg-[#1A1D27] rounded-xl border border-[#2A2D3A] overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#2A2D3A]">
        <div>
          <h2 className="text-[#F1F5F9] font-semibold text-sm">Citas recientes</h2>
          <p className="text-[#94A3B8] text-xs mt-0.5">Últimas {data.length} del período</p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#2A2D3A]">
              {['Atleta', 'Especialista', 'Tipo', 'Fecha / Hora', 'Estado'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-[#94A3B8] uppercase tracking-wide">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#2A2D3A]">
            {data.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-[#94A3B8] text-sm">
                  Sin citas en este período
                </td>
              </tr>
            ) : data.map(apt => {
              const sc = STATUS_CONFIG[apt.status] ?? STATUS_CONFIG.confirmed;
              return (
                <tr key={apt.id} className="hover:bg-[#2A2D3A]/40 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-indigo-500/20 flex items-center justify-center text-xs text-indigo-300 font-medium">
                        {apt.athlete.full_name.charAt(0)}
                      </div>
                      <span className="text-sm text-[#F1F5F9]">{apt.athlete.full_name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-[#94A3B8]">{apt.specialist.full_name}</td>
                  <td className="px-4 py-3 text-sm text-[#94A3B8]">
                    {SERVICE_ICONS[apt.service_type]} {apt.service_type}
                  </td>
                  <td className="px-4 py-3 text-xs text-[#94A3B8]">
                    <div>{format(new Date(apt.date), 'dd MMM yyyy', { locale: es })}</div>
                    <div className="text-[#6B7280]">{apt.time}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded border text-xs font-medium ${sc.className}`}>
                      {sc.label}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="px-5 py-4 border-t border-[#2A2D3A]">
        <button
          onClick={onOpenDrawer}
          className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors"
        >
          Ver tabla completa con filtros y exportación →
        </button>
      </div>
    </div>
  );
}
