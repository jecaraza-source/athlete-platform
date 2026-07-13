'use client';
import { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  fetchFilteredAppointments,
  fetchAllAppointmentsForExport,
  updateAppointmentStatus,
} from '@/lib/adminQueries';
import { exportAppointmentsToExcel } from '@/lib/exportToExcel';
import { triggerPrint } from '@/lib/printHelpers';
import { useToast } from '@/hooks/useToast';
import type { Appointment, AppointmentFilters } from '@/lib/types/admin';

// ── Inline toast renderer ──────────────────────────────────────────────────────
function ToastContainer({ toasts, dismiss }: { toasts: ReturnType<typeof useToast>['toasts']; dismiss: (id: string) => void }) {
  if (toasts.length === 0) return null;
  return (
    <div className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2 no-print">
      {toasts.map(t => (
        <div key={t.id}
          className={`px-4 py-3 rounded-xl border shadow-lg text-sm flex items-start gap-3 min-w-64 max-w-sm ${
            t.variant === 'destructive'
              ? 'bg-red-900/90 border-red-500/50 text-red-100'
              : 'bg-[#1A1D27] border-[#2A2D3A] text-[#F1F5F9]'
          }`}>
          <div className="flex-1">
            <p className="font-medium text-xs">{t.title}</p>
            {t.description && <p className="text-[10px] text-[#94A3B8] mt-0.5">{t.description}</p>}
          </div>
          <button onClick={() => dismiss(t.id)} className="text-[#6B7280] hover:text-[#94A3B8] text-xs">✕</button>
        </div>
      ))}
    </div>
  );
}
// ──────────────────────────────────────────────────────────────────────────────

const EMPTY_FILTERS: AppointmentFilters = {
  serviceType: 'all', status: 'all',
  dateFrom: '', dateTo: '', search: '',
};

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  confirmed:      { label: 'Confirmada',       className: 'bg-blue-500/20   text-blue-300   border-blue-500/30' },
  show:           { label: 'Atendió',          className: 'bg-green-500/20  text-green-300  border-green-500/30' },
  no_show:        { label: 'No Atendió',       className: 'bg-red-500/20    text-red-300    border-red-500/30' },
  no_show_remote: { label: 'Llamada/Mensaje', className: 'bg-orange-500/20 text-orange-300 border-orange-500/30' },
  rescheduled:    { label: 'Reagendada',       className: 'bg-amber-500/20  text-amber-300  border-amber-500/30' },
  cancelled:      { label: 'Cancelada',        className: 'bg-gray-500/20   text-gray-300   border-gray-500/30' },
};

interface Props {
  open: boolean;
  onClose: () => void;
  from: string;
  to: string;
  periodLabel: string;
  currentUserId: string;
}

const PAGE_SIZE = 20;

export function AppointmentsDrawer({ open, onClose, from, to, periodLabel, currentUserId }: Props) {
  const { toast, toasts, dismiss } = useToast();
  const [filters, setFilters]   = useState<AppointmentFilters>(EMPTY_FILTERS);
  const [data, setData]         = useState<Appointment[]>([]);
  const [total, setTotal]       = useState(0);
  const [page, setPage]         = useState(0);
  const [loading, setLoading]   = useState(false);
  const [exporting, setExporting] = useState(false);
  const [printing, setPrinting]   = useState(false);
  const [actionMenu, setActionMenu] = useState<string | null>(null);
  const drawerRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    setLoading(true);
    try {
      const result = await fetchFilteredAppointments(from, to, filters, page, PAGE_SIZE);
      setData(result.data);
      setTotal(result.total);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (open) load(); }, [open, filters, page, from, to]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setPage(0); }, [filters]);

  // Focus trap + ESC
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    drawerRef.current?.focus();
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  // Close action menu on outside click
  useEffect(() => {
    if (!actionMenu) return;
    const close = () => setActionMenu(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [actionMenu]);

  const handleExportExcel = async () => {
    setExporting(true);
    try {
      const all    = await fetchAllAppointmentsForExport(from, to, filters);
      const buffer = await exportAppointmentsToExcel(all, periodLabel);

      // Trigger browser download from the server-generated buffer
      const blob      = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url       = URL.createObjectURL(blob);
      const stamp     = new Date().toISOString().slice(0, 16).replace(/[-T:]/g, '').replace('T', '-');
      const safePeriod = periodLabel.replace(/\s/g, '-').toLowerCase();
      const anchor    = document.createElement('a');
      anchor.href     = url;
      anchor.download = `citas-ao-deporte-${safePeriod}-${stamp}.xlsx`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);

      toast({ title: '✅ Excel generado', description: `${all.length} registros exportados` });
    } catch {
      toast({ title: 'Error al exportar', variant: 'destructive' });
    } finally {
      setExporting(false);
    }
  };

  const handlePrint = async () => {
    setPrinting(true);
    try {
      const all = await fetchAllAppointmentsForExport(from, to, filters);
      await triggerPrint(all, periodLabel);
    } finally {
      setPrinting(false);
    }
  };

  const handleAction = async (apt: Appointment, action: 'show' | 'no_show') => {
    try {
      // currentUserId is now resolved server-side via requireAdminAccess() inside the action.
      await updateAppointmentStatus(apt.id, action);
      toast({ title: action === 'show' ? '✅ Show registrado' : '❌ No show registrado' });
      setActionMenu(null);
      load();
    } catch {
      toast({ title: 'Error', description: 'No se pudo actualizar la cita', variant: 'destructive' });
    }
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const hasFilters = filters.serviceType !== 'all' || filters.status !== 'all' || !!filters.search || !!filters.dateFrom;

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm no-print"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Tabla completa de citas"
        tabIndex={-1}
        className="fixed top-0 right-0 bottom-0 z-50 w-full md:w-[90vw] bg-[#0F1117]
                   border-l border-[#2A2D3A] flex flex-col no-print outline-none"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2A2D3A] flex-shrink-0">
          <div>
            <h2 className="text-[#F1F5F9] font-semibold">Citas — {periodLabel}</h2>
            <p className="text-[#94A3B8] text-xs">{total} registros encontrados</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handlePrint} disabled={printing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#2A2D3A]
                         text-xs text-[#94A3B8] hover:text-[#F1F5F9] hover:border-indigo-500/50 transition-all disabled:opacity-50">
              🖨 {printing ? 'Preparando...' : 'Imprimir'}
            </button>
            <button onClick={handleExportExcel} disabled={exporting}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/20 border border-emerald-500/30
                         text-xs text-emerald-300 hover:bg-emerald-600/30 transition-all disabled:opacity-50">
              📥 {exporting ? 'Generando...' : 'Exportar Excel'}
            </button>
            <button onClick={onClose} aria-label="Cerrar"
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#2A2D3A]
                         text-[#94A3B8] hover:text-[#F1F5F9] transition-all text-lg">
              ✕
            </button>
          </div>
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap gap-2 px-6 py-3 border-b border-[#2A2D3A] flex-shrink-0 bg-[#1A1D27]">
          <select value={filters.serviceType}
            onChange={e => setFilters(f => ({ ...f, serviceType: e.target.value as AppointmentFilters['serviceType'] }))}
            className="bg-[#0F1117] border border-[#2A2D3A] text-[#F1F5F9] text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-indigo-500">
            <option value="all">Todas las especialidades</option>
            <option value="medico">Consulta Médica</option>
            <option value="nutricion">Nutrición</option>
            <option value="fisioterapia">Fisioterapia</option>
            <option value="psicologia">Psicología</option>
            <option value="evaluacion">Evaluación</option>
            <option value="entrenamiento">Entrenamiento</option>
          </select>

          <select value={filters.status}
            onChange={e => setFilters(f => ({ ...f, status: e.target.value as AppointmentFilters['status'] }))}
            className="bg-[#0F1117] border border-[#2A2D3A] text-[#F1F5F9] text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-indigo-500">
            <option value="all">Todos los estados</option>
            <option value="confirmed">Programada</option>
            <option value="show">Atendió</option>
            <option value="no_show">No Atendió</option>
            <option value="no_show_remote">📞 Llamada/Mensaje</option>
            <option value="rescheduled">Reagendada</option>
            <option value="cancelled">Cancelada</option>
          </select>

          <input type="date" value={filters.dateFrom}
            onChange={e => setFilters(f => ({ ...f, dateFrom: e.target.value }))}
            className="bg-[#0F1117] border border-[#2A2D3A] text-[#94A3B8] text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-indigo-500" />

          <input type="date" value={filters.dateTo}
            onChange={e => setFilters(f => ({ ...f, dateTo: e.target.value }))}
            className="bg-[#0F1117] border border-[#2A2D3A] text-[#94A3B8] text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-indigo-500" />

          <input type="search" value={filters.search} placeholder="🔍 Buscar atleta o especialista"
            onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
            className="flex-1 min-w-48 bg-[#0F1117] border border-[#2A2D3A] text-[#F1F5F9] text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-indigo-500 placeholder:text-[#6B7280]" />

          {hasFilters && (
            <button onClick={() => setFilters(EMPTY_FILTERS)}
              className="text-xs text-[#94A3B8] hover:text-red-400 transition-colors px-2">
              Limpiar filtros
            </button>
          )}
        </div>

        {/* Tabla */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center h-40 text-[#94A3B8] text-sm">
              <span className="animate-pulse">Cargando...</span>
            </div>
          ) : data.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-[#94A3B8]">
              <span className="text-3xl mb-2">📭</span>
              <span className="text-sm">Sin resultados para estos filtros</span>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-[#1A1D27] z-10">
                <tr className="border-b border-[#2A2D3A]">
                  {['#', 'Atleta', 'Especialista', 'Tipo', 'Fecha', 'Hora', 'Estado', 'Notas', 'Acciones'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-[#94A3B8] uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2A2D3A]">
                {data.map((apt, i) => {
                  const sc     = STATUS_CONFIG[apt.status] ?? STATUS_CONFIG.confirmed;
                  const rowNum = page * PAGE_SIZE + i + 1;
                  return (
                    <tr key={apt.id} className="hover:bg-[#1A1D27]/80 transition-colors">
                      <td className="px-4 py-3 text-xs text-[#6B7280]">{rowNum}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-indigo-500/20 flex items-center justify-center text-xs text-indigo-300 font-medium flex-shrink-0">
                            {apt.athlete.full_name.charAt(0)}
                          </div>
                          <span className="text-[#F1F5F9] whitespace-nowrap">{apt.athlete.full_name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[#94A3B8] whitespace-nowrap">{apt.specialist.full_name}</td>
                      <td className="px-4 py-3 text-[#94A3B8] text-xs whitespace-nowrap">{apt.service_type}</td>
                      <td className="px-4 py-3 text-xs text-[#94A3B8] whitespace-nowrap">
                        {format(new Date(apt.date), 'dd/MM/yyyy', { locale: es })}
                      </td>
                      <td className="px-4 py-3 text-xs text-[#6B7280]">{apt.time}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded border text-xs font-medium whitespace-nowrap ${sc.className}`}>
                          {sc.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-[#94A3B8] max-w-xs truncate">
                        {apt.notes ?? '—'}
                      </td>
                      <td className="px-4 py-3 relative">
                        <button
                          onClick={e => { e.stopPropagation(); setActionMenu(actionMenu === apt.id ? null : apt.id); }}
                          className="px-2 py-1 rounded hover:bg-[#2A2D3A] text-[#94A3B8] hover:text-[#F1F5F9] text-xs transition-all"
                          aria-haspopup="true"
                          aria-expanded={actionMenu === apt.id}
                        >
                          ⋯
                        </button>
                        {actionMenu === apt.id && (
                          <div
                            onClick={e => e.stopPropagation()}
                            className="absolute right-4 top-10 z-20 bg-[#1A1D27] border border-[#2A2D3A] rounded-lg shadow-xl min-w-44 py-1"
                          >
                            <button onClick={() => handleAction(apt, 'show')}
                              className="w-full text-left px-4 py-2 text-xs text-[#F1F5F9] hover:bg-emerald-500/10 hover:text-emerald-300 transition-colors flex items-center gap-2">
                              ✅ Marcar Show
                            </button>
                            <button onClick={() => handleAction(apt, 'no_show')}
                              className="w-full text-left px-4 py-2 text-xs text-[#F1F5F9] hover:bg-red-500/10 hover:text-red-300 transition-colors flex items-center gap-2">
                              ❌ Marcar No Show
                            </button>
                            <hr className="border-[#2A2D3A] my-1" />
                            <a href={`/medical/appointments/${apt.id}`}
                              className="block w-full text-left px-4 py-2 text-xs text-[#F1F5F9] hover:bg-amber-500/10 hover:text-amber-300 transition-colors flex items-center gap-2">
                              🔄 Reagendar (ir a cita)
                            </a>
                            <a href={`/admin/athletes/${apt.athlete.id}`}
                              className="block w-full text-left px-4 py-2 text-xs text-[#94A3B8] hover:bg-[#2A2D3A] hover:text-[#F1F5F9] transition-colors flex items-center gap-2">
                              📋 Ver perfil atleta
                            </a>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Paginación */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-3 border-t border-[#2A2D3A] flex-shrink-0 bg-[#1A1D27]">
            <span className="text-xs text-[#94A3B8]">
              Página {page + 1} de {totalPages} · {total} registros
            </span>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                className="px-3 py-1.5 text-xs rounded-lg border border-[#2A2D3A] text-[#94A3B8] hover:text-[#F1F5F9] hover:border-indigo-500 disabled:opacity-30 transition-all">
                ← Anterior
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const p = Math.max(0, Math.min(page - 2 + i, totalPages - 1));
                return (
                  <button key={p} onClick={() => setPage(p)}
                    className={`px-3 py-1.5 text-xs rounded-lg border transition-all ${
                      p === page
                        ? 'bg-indigo-600 border-indigo-600 text-white'
                        : 'border-[#2A2D3A] text-[#94A3B8] hover:text-[#F1F5F9] hover:border-indigo-500'
                    }`}>
                    {p + 1}
                  </button>
                );
              })}
              <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                className="px-3 py-1.5 text-xs rounded-lg border border-[#2A2D3A] text-[#94A3B8] hover:text-[#F1F5F9] hover:border-indigo-500 disabled:opacity-30 transition-all">
                Siguiente →
              </button>
            </div>
          </div>
        )}
      </div>

      <ToastContainer toasts={toasts} dismiss={dismiss} />
    </>
  );
}
