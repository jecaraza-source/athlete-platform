'use client';
import type { PeriodKey } from '@/lib/types/admin';

const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: 'today',   label: 'Hoy' },
  { key: 'week',    label: 'Esta semana' },
  { key: 'month',   label: 'Este mes' },
  { key: '3months', label: 'Últimos 3 meses' },
];

const ROLE_COLORS: Record<string, string> = {
  super_admin:  'bg-purple-500/20 text-purple-300 border-purple-500/30',
  coordinador:  'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
  admin:        'bg-blue-500/20   text-blue-300   border-blue-500/30',
  logistica:    'bg-amber-500/20  text-amber-300  border-amber-500/30',
  operaciones:  'bg-teal-500/20   text-teal-300   border-teal-500/30',
};

interface Props {
  userName: string;
  role: string;
  period: PeriodKey;
  onPeriodChange: (p: PeriodKey) => void;
  onLogout: () => void;
}

export function AdminHeader({ userName, role, period, onPeriodChange, onLogout }: Props) {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-16 flex items-center justify-between px-6
                       bg-[#0F1117]/95 backdrop-blur border-b border-[#2A2D3A] no-print">
      {/* Logo + título */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-sm">
          AO
        </div>
        <div>
          <span className="text-[#F1F5F9] font-semibold text-sm">AO Deporte</span>
          <span className="text-[#94A3B8] text-xs ml-2">Admin Console</span>
        </div>
      </div>

      {/* Selector de período */}
      <nav className="flex items-center gap-1 bg-[#1A1D27] rounded-lg p-1">
        {PERIODS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => onPeriodChange(key)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              period === key
                ? 'bg-indigo-600 text-white'
                : 'text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-[#2A2D3A]'
            }`}
          >
            {label}
          </button>
        ))}
      </nav>

      {/* Usuario + logout */}
      <div className="flex items-center gap-3">
        <span className="text-[#94A3B8] text-xs">{userName}</span>
        <span className={`px-2 py-0.5 rounded border text-xs font-medium ${ROLE_COLORS[role] ?? 'bg-gray-500/20 text-gray-300 border-gray-500/30'}`}>
          {role}
        </span>
        <button
          onClick={onLogout}
          className="text-xs text-[#94A3B8] hover:text-red-400 transition-colors px-2 py-1 rounded hover:bg-red-500/10"
        >
          Cerrar sesión
        </button>
      </div>
    </header>
  );
}
