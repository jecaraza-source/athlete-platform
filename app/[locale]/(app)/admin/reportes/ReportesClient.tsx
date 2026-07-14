'use client';
// ---------------------------------------------------------------------------
// ReportesClient
// ---------------------------------------------------------------------------
// Renders the "Resumen Metas Plataforma" report with four period options:
//   Diario · Semanal · Mensual · Trimestral
//
// Print button injects a clean HTML table into the hidden #print-root node
// and calls window.print().  The existing @media print CSS in globals.css
// hides every other element and shows only #print-root.
// ---------------------------------------------------------------------------

import { useState, useEffect }       from 'react';
import Link                           from 'next/link';
import { getReportPeriodRange }       from '@/lib/periods';
import { fetchReportData }            from '@/lib/adminReportQueries';
import type {
  ReportData, ReportPeriodKey, ReportServiceRow, ReportCoachRow,
  ReportStaffMemberRow, ReportDisciplineRow,
} from '@/lib/types/admin';
import type { ReportPeriodMeta }      from '@/lib/periods';

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  defaultPeriod: ReportPeriodKey;
  initialMeta:   ReportPeriodMeta;
  initialData:   ReportData;
}

// ─── Period picker config ─────────────────────────────────────────────────────────────

const PERIODS: { key: ReportPeriodKey; label: string }[] = [
  { key: 'today',   label: 'Diario' },
  { key: 'week',    label: 'Semanal' },
  { key: 'month',   label: 'Mensual' },
  { key: 'quarter', label: 'Trimestral' },
];

type ActiveTab = ReportPeriodKey | 'custom';

// Format YYYY-MM-DD → dd/mm/yyyy
function fmtDisplay(iso: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

// ─── Print helper (iframe-based) ─────────────────────────────────────────────
// Uses a hidden <iframe> so the report has its own document with self-contained
// styles, independent of the parent page DOM / CSS.  This works regardless of
// how deeply #print-root is nested inside Next.js layout wrappers.

const IFRAME_STYLES = `
  *, *::before, *::after { box-sizing: border-box; }
  body {
    font-family: Arial, sans-serif;
    font-size: 11px;
    color: #000;
    background: #fff;
    padding: 20px;
    margin: 0;
  }
  .print-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 16px;
    border-bottom: 2px solid #000;
    padding-bottom: 8px;
  }
  .section-title {
    margin: 16px 0 4px;
    font-weight: 700;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    border-bottom: 2px solid #111;
    padding-bottom: 3px;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 4px;
  }
  th {
    background: #e5e7eb;
    border: 1px solid #9ca3af;
    padding: 5px 8px;
    text-align: left;
    font-weight: 700;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  td {
    border: 1px solid #d1d5db;
    padding: 4px 8px;
    vertical-align: top;
  }
  tr:nth-child(even) td { background: #f9fafb; }
  .print-footer {
    margin-top: 16px;
    font-size: 9px;
    color: #6b7280;
    border-top: 1px solid #e5e7eb;
    padding-top: 6px;
  }
  @page { margin: 1.5cm; size: landscape; }
`;

function buildPrintDocument(data: ReportData, meta: ReportPeriodMeta, logoUrl: string): string {
  const today = new Date().toLocaleString('es-MX', { timeZone: 'America/Mexico_City' });

  const serviceRows = data.services.map((r: ReportServiceRow) => `
    <tr>
      <td style="font-weight:700">${r.service}</td>
      <td style="text-align:center">${r.scheduled}</td>
      <td style="text-align:center">${r.attendedPresential}</td>
      <td style="text-align:center">${r.attendedRemote === null ? 'NO APLICA' : r.attendedRemote}</td>
      <td style="text-align:center">${r.followUpNotes}</td>
      <td style="text-align:center">${r.noShow}</td>
    </tr>`).join('');

  const coachRows = data.coaches.length > 0
    ? data.coaches.map((c: ReportCoachRow) => `
    <tr>
      <td style="font-weight:700">ENTRENADOR ${c.discipline.toUpperCase()}</td>
      <td style="text-align:center">${c.totalAthletes}</td>
      <td style="text-align:center">${c.totalPlans}</td>
      <td style="text-align:center">${c.totalNotes}</td>
    </tr>`).join('')
    : '<tr><td colspan="4" style="text-align:center;color:#9ca3af;padding:12px">Sin datos de entrenadores para este período</td></tr>';

  const staffRows = data.staffMembers.length > 0
    ? data.staffMembers.map((s: ReportStaffMemberRow) => `
    <tr>
      <td>
        <div style="font-weight:700">${s.staffName}</div>
        <div style="font-size:9px;color:#6b7280">${s.roleLabel}</div>
      </td>
      <td style="text-align:center">${s.scheduled}</td>
      <td style="text-align:center">${s.attendedPresential}</td>
      <td style="text-align:center">${s.attendedRemote}</td>
      <td style="text-align:center">${s.rescheduled}</td>
      <td style="text-align:center">${s.noShow}</td>
    </tr>`).join('')
    : '<tr><td colspan="6" style="text-align:center;color:#9ca3af;padding:12px">Sin actividad de staff médico para este período</td></tr>';

  const disciplineRows = data.disciplines.length > 0
    ? data.disciplines.map((d: ReportDisciplineRow) => `
    <tr>
      <td>
        <div style="font-weight:700">${d.disciplineName}</div>
        <div style="font-size:9px;color:#6b7280">${d.disciplineBlock}</div>
      </td>
      <td style="text-align:center">${d.totalAthletes}</td>
      <td style="text-align:center">${d.athletesAttended}</td>
      <td style="text-align:center">${d.athletesNoShow}</td>
      <td style="text-align:center">${d.athletesWithPlans}</td>
    </tr>`).join('')
    : '<tr><td colspan="5" style="text-align:center;color:#9ca3af;padding:12px">Sin atletas registrados por disciplina</td></tr>';

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>${meta.reportTitle} — AO Deportes</title>
  <style>${IFRAME_STYLES}</style>
</head>
<body>
  <div class="print-header">
    <div style="display:flex;align-items:center;gap:14px">
      <img src="${logoUrl}" alt="AO Deporte" style="height:60px;width:auto;display:block">
      <div>
        <div style="font-size:12px;font-weight:700">${meta.reportTitle} — RESUMEN METAS PLATAFORMA</div>
      </div>
    </div>
    <div style="text-align:right;font-size:11px;line-height:1.6">
      <div><strong>PERÍODO:</strong> ${meta.label}</div>
      <div><strong>TOTAL ATLETAS ACTIVOS:</strong> ${data.activeAthletes}</div>
    </div>
  </div>

  <div class="section-title">Servicios de Salud</div>
  <table>
    <thead>
      <tr>
        <th style="width:18%">SERVICIOS</th>
        <th style="width:16.4%;text-align:center">TOTAL CITAS PROGRAMADAS</th>
        <th style="width:16.4%;text-align:center">CITAS ATENDIDAS PRESENCIAL</th>
        <th style="width:16.4%;text-align:center">CITAS ATENDIDAS VÍA REMOTA</th>
        <th style="width:16.4%;text-align:center">NOTAS DE SEGUIMIENTO</th>
        <th style="width:16.4%;text-align:center">CITAS NO ATENDIDAS</th>
      </tr>
    </thead>
    <tbody>${serviceRows}</tbody>
  </table>

  <div class="section-title" style="margin-top:20px">Entrenadores</div>
  <table>
    <thead>
      <tr>
        <th style="width:34%">ENTRENADOR / DISCIPLINA</th>
        <th style="width:22%;text-align:center">ATLETAS CON PLAN<br><span style="font-size:9px;font-weight:400">(acumulado)</span></th>
        <th style="width:22%;text-align:center">PLANES ASIGNADOS<br><span style="font-size:9px;font-weight:400">(acumulado)</span></th>
        <th style="width:22%;text-align:center">NOTAS SEGUIMIENTO<br><span style="font-size:9px;font-weight:400">(en el período)</span></th>
      </tr>
    </thead>
    <tbody>${coachRows}</tbody>
  </table>

  <div class="section-title" style="margin-top:20px">Staff Médico (por miembro)</div>
  <table>
    <thead>
      <tr>
        <th style="width:22%">NOMBRE / ROL</th>
        <th style="width:15.6%;text-align:center">CITAS AGENDADAS</th>
        <th style="width:15.6%;text-align:center">ATENDIDAS PRESENCIAL</th>
        <th style="width:15.6%;text-align:center">ATENDIDAS REMOTO</th>
        <th style="width:15.6%;text-align:center">REPROGRAMADAS</th>
        <th style="width:15.6%;text-align:center">NO ATENDIDAS</th>
      </tr>
    </thead>
    <tbody>${staffRows}</tbody>
  </table>

  <div class="section-title" style="margin-top:20px">Por Disciplina</div>
  <table>
    <thead>
      <tr>
        <th style="width:25%">DISCIPLINA</th>
        <th style="width:18.75%;text-align:center">TOTAL ATLETAS</th>
        <th style="width:18.75%;text-align:center">ATLETAS QUE ASISTIERON<br><span style="font-size:9px;font-weight:400">(en el período)</span></th>
        <th style="width:18.75%;text-align:center">ATLETAS NO ASISTIERON<br><span style="font-size:9px;font-weight:400">(en el período)</span></th>
        <th style="width:18.75%;text-align:center">CON PLAN ASIGNADO<br><span style="font-size:9px;font-weight:400">(acumulado)</span></th>
      </tr>
    </thead>
    <tbody>${disciplineRows}</tbody>
  </table>

  <div class="print-footer">
    Sistema AO Deportes · aodeporte.com · Impreso: ${today}
  </div>
</body>
</html>`;
}

function triggerPrint(data: ReportData, meta: ReportPeriodMeta) {
  // Reuse or create a hidden iframe attached to document.body
  const IFRAME_ID = 'report-print-frame';
  let iframe = document.getElementById(IFRAME_ID) as HTMLIFrameElement | null;
  if (!iframe) {
    iframe = document.createElement('iframe');
    iframe.id = IFRAME_ID;
    // Visually hidden but not display:none (display:none prevents printing in some browsers)
    iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:0;opacity:0;';
    document.body.appendChild(iframe);
  }

  const doc = iframe.contentDocument ?? iframe.contentWindow?.document;
  if (!doc) return;

  const logoUrl = `${window.location.origin}/Logo%20AO%20Deporte.png`;

  doc.open();
  doc.write(buildPrintDocument(data, meta, logoUrl));
  doc.close();

  // Small delay so the iframe finishes rendering before the print dialog opens
  iframe.onload = () => {
    iframe!.contentWindow?.focus();
    iframe!.contentWindow?.print();
  };
  // Fallback: some browsers fire onload before doc.write finishes
  setTimeout(() => {
    iframe!.contentWindow?.focus();
    iframe!.contentWindow?.print();
  }, 250);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ label, value, accent = false }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className={`rounded-lg border p-4 text-center ${
      accent
        ? 'border-indigo-500/40 bg-indigo-600/10'
        : 'border-[#2A2D3A] bg-[#1A1D27]'
    }`}>
      <div className="text-2xl font-bold text-[#F1F5F9]">{value}</div>
      <div className="text-xs text-[#94A3B8] mt-1">{label}</div>
    </div>
  );
}

function ServiceTable({ rows, loading }: { rows: ReportServiceRow[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="rounded-xl border border-[#2A2D3A] h-40 animate-pulse bg-[#1A1D27]" />
    );
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-[#2A2D3A]">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[#2A2D3A] bg-[#1A1D27]">
            <th className="px-4 py-3 text-left text-xs font-semibold text-[#94A3B8] uppercase tracking-wide">Servicio</th>
            <th className="px-4 py-3 text-center text-xs font-semibold text-[#94A3B8] uppercase tracking-wide">Citas Programadas</th>
            <th className="px-4 py-3 text-center text-xs font-semibold text-[#94A3B8] uppercase tracking-wide">Atendidas Presencial</th>
            <th className="px-4 py-3 text-center text-xs font-semibold text-[#94A3B8] uppercase tracking-wide">Atendidas Remoto</th>
            <th className="px-4 py-3 text-center text-xs font-semibold text-[#94A3B8] uppercase tracking-wide">Notas Seguimiento</th>
            <th className="px-4 py-3 text-center text-xs font-semibold text-[#94A3B8] uppercase tracking-wide">No Atendidas</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr
              key={r.service}
              className={`border-b border-[#2A2D3A]/50 last:border-0 ${
                i % 2 === 0 ? 'bg-[#0F1117]' : 'bg-[#1A1D27]/40'
              }`}
            >
              <td className="px-4 py-3 font-semibold text-[#F1F5F9]">{r.service}</td>
              <td className="px-4 py-3 text-center">
                <span className="rounded bg-[#2A2D3A] px-2 py-0.5 text-[#F1F5F9] font-medium">{r.scheduled}</span>
              </td>
              <td className="px-4 py-3 text-center">
                <span className="rounded bg-emerald-900/30 px-2 py-0.5 text-emerald-300 font-medium">{r.attendedPresential}</span>
              </td>
              <td className="px-4 py-3 text-center">
                {r.attendedRemote === null ? (
                  <span className="text-[#94A3B8] text-xs italic">NO APLICA</span>
                ) : (
                  <span className="rounded bg-blue-900/30 px-2 py-0.5 text-blue-300 font-medium">{r.attendedRemote}</span>
                )}
              </td>
              <td className="px-4 py-3 text-center">
                <span className="rounded bg-indigo-900/30 px-2 py-0.5 text-indigo-300 font-medium">{r.followUpNotes}</span>
              </td>
              <td className="px-4 py-3 text-center">
                {r.noShow > 0 ? (
                  <span className="rounded bg-red-900/30 px-2 py-0.5 text-red-400 font-medium">{r.noShow}</span>
                ) : (
                  <span className="text-[#94A3B8]">0</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StaffMemberTable({ rows, loading }: { rows: ReportStaffMemberRow[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="rounded-xl border border-[#2A2D3A] h-36 animate-pulse bg-[#1A1D27]" />
    );
  }
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[#2A2D3A] py-10 text-center">
        <p className="text-[#94A3B8] text-sm">Sin actividad de staff médico en el período seleccionado</p>
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-[#2A2D3A]">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[#2A2D3A] bg-[#1A1D27]">
            <th className="px-4 py-3 text-left text-xs font-semibold text-[#94A3B8] uppercase tracking-wide">Nombre / Rol</th>
            <th className="px-4 py-3 text-center text-xs font-semibold text-[#94A3B8] uppercase tracking-wide">Citas Agendadas</th>
            <th className="px-4 py-3 text-center text-xs font-semibold text-[#94A3B8] uppercase tracking-wide">Atendidas Presencial</th>
            <th className="px-4 py-3 text-center text-xs font-semibold text-[#94A3B8] uppercase tracking-wide">Atendidas Remoto</th>
            <th className="px-4 py-3 text-center text-xs font-semibold text-[#94A3B8] uppercase tracking-wide">Reprogramadas</th>
            <th className="px-4 py-3 text-center text-xs font-semibold text-[#94A3B8] uppercase tracking-wide">No Atendidas</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s, i) => (
            <tr
              key={s.staffId}
              className={`border-b border-[#2A2D3A]/50 last:border-0 ${
                i % 2 === 0 ? 'bg-[#0F1117]' : 'bg-[#1A1D27]/40'
              }`}
            >
              <td className="px-4 py-3">
                <div className="font-semibold text-[#F1F5F9]">{s.staffName}</div>
                <div className="text-xs text-[#94A3B8] mt-0.5">{s.roleLabel}</div>
              </td>
              <td className="px-4 py-3 text-center">
                <span className="rounded bg-[#2A2D3A] px-2 py-0.5 text-[#F1F5F9] font-medium">{s.scheduled}</span>
              </td>
              <td className="px-4 py-3 text-center">
                <span className="rounded bg-emerald-900/30 px-2 py-0.5 text-emerald-300 font-medium">{s.attendedPresential}</span>
              </td>
              <td className="px-4 py-3 text-center">
                {s.attendedRemote > 0 ? (
                  <span className="rounded bg-blue-900/30 px-2 py-0.5 text-blue-300 font-medium">{s.attendedRemote}</span>
                ) : (
                  <span className="text-[#94A3B8]">0</span>
                )}
              </td>
              <td className="px-4 py-3 text-center">
                {s.rescheduled > 0 ? (
                  <span className="rounded bg-amber-900/30 px-2 py-0.5 text-amber-300 font-medium">{s.rescheduled}</span>
                ) : (
                  <span className="text-[#94A3B8]">0</span>
                )}
              </td>
              <td className="px-4 py-3 text-center">
                {s.noShow > 0 ? (
                  <span className="rounded bg-red-900/30 px-2 py-0.5 text-red-400 font-medium">{s.noShow}</span>
                ) : (
                  <span className="text-[#94A3B8]">0</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DisciplineTable({ rows, loading }: { rows: ReportDisciplineRow[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="rounded-xl border border-[#2A2D3A] h-36 animate-pulse bg-[#1A1D27]" />
    );
  }
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[#2A2D3A] py-10 text-center">
        <p className="text-[#94A3B8] text-sm">Sin atletas con disciplina registrada</p>
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-[#2A2D3A]">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[#2A2D3A] bg-[#1A1D27]">
            <th className="px-4 py-3 text-left text-xs font-semibold text-[#94A3B8] uppercase tracking-wide">Disciplina</th>
            <th className="px-4 py-3 text-center text-xs font-semibold text-[#94A3B8] uppercase tracking-wide">Total Atletas</th>
            <th className="px-4 py-3 text-center text-xs font-semibold text-[#94A3B8] uppercase tracking-wide">
              <div>Atletas que Asistieron</div>
              <div className="text-[10px] font-normal text-[#64748B] normal-case tracking-normal mt-0.5">en el período</div>
            </th>
            <th className="px-4 py-3 text-center text-xs font-semibold text-[#94A3B8] uppercase tracking-wide">
              <div>Atletas No Asistieron</div>
              <div className="text-[10px] font-normal text-[#64748B] normal-case tracking-normal mt-0.5">en el período</div>
            </th>
            <th className="px-4 py-3 text-center text-xs font-semibold text-[#94A3B8] uppercase tracking-wide">
              <div>Con Plan Asignado</div>
              <div className="text-[10px] font-normal text-[#64748B] normal-case tracking-normal mt-0.5">acumulado</div>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((d, i) => (
            <tr
              key={d.disciplineCode}
              className={`border-b border-[#2A2D3A]/50 last:border-0 ${
                i % 2 === 0 ? 'bg-[#0F1117]' : 'bg-[#1A1D27]/40'
              }`}
            >
              <td className="px-4 py-3">
                <div className="font-semibold text-[#F1F5F9]">{d.disciplineName}</div>
                <div className="text-xs text-[#94A3B8] mt-0.5">{d.disciplineBlock}</div>
              </td>
              <td className="px-4 py-3 text-center">
                <span className="rounded bg-[#2A2D3A] px-2 py-0.5 text-[#F1F5F9] font-medium">{d.totalAthletes}</span>
              </td>
              <td className="px-4 py-3 text-center">
                <span className="rounded bg-teal-900/30 px-2 py-0.5 text-teal-300 font-medium">{d.athletesAttended}</span>
              </td>
              <td className="px-4 py-3 text-center">
                {d.athletesNoShow > 0 ? (
                  <span className="rounded bg-red-900/30 px-2 py-0.5 text-red-400 font-medium">{d.athletesNoShow}</span>
                ) : (
                  <span className="text-[#94A3B8]">0</span>
                )}
              </td>
              <td className="px-4 py-3 text-center">
                <span className="rounded bg-indigo-900/30 px-2 py-0.5 text-indigo-300 font-medium">{d.athletesWithPlans}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CoachTable({ rows, loading }: { rows: ReportCoachRow[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="rounded-xl border border-[#2A2D3A] h-32 animate-pulse bg-[#1A1D27]" />
    );
  }
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[#2A2D3A] py-10 text-center">
        <p className="text-[#94A3B8] text-sm">Sin planes de entrenamiento asignados ni sesiones registradas</p>
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-[#2A2D3A]">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[#2A2D3A] bg-[#1A1D27]">
            <th className="px-4 py-3 text-left text-xs font-semibold text-[#94A3B8] uppercase tracking-wide">Disciplina / Entrenador</th>
            <th className="px-4 py-3 text-center text-xs font-semibold text-[#94A3B8] uppercase tracking-wide">
              <div>Atletas con Plan</div>
              <div className="text-[10px] font-normal text-[#64748B] normal-case tracking-normal mt-0.5">acumulado</div>
            </th>
            <th className="px-4 py-3 text-center text-xs font-semibold text-[#94A3B8] uppercase tracking-wide">
              <div>Planes Asignados</div>
              <div className="text-[10px] font-normal text-[#64748B] normal-case tracking-normal mt-0.5">acumulado</div>
            </th>
            <th className="px-4 py-3 text-center text-xs font-semibold text-[#94A3B8] uppercase tracking-wide">
              <div>Notas de Seguimiento</div>
              <div className="text-[10px] font-normal text-[#64748B] normal-case tracking-normal mt-0.5">en el período</div>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c, i) => (
            <tr
              key={c.coachId}
              className={`border-b border-[#2A2D3A]/50 last:border-0 ${
                i % 2 === 0 ? 'bg-[#0F1117]' : 'bg-[#1A1D27]/40'
              }`}
            >
              <td className="px-4 py-3">
                <div className="font-semibold text-[#F1F5F9]">
                  {c.discipline.toUpperCase()}
                </div>
                <div className="text-xs text-[#94A3B8] mt-0.5">{c.coachName}</div>
              </td>
              <td className="px-4 py-3 text-center">
                <span className="rounded bg-teal-900/30 px-2 py-0.5 text-teal-300 font-medium">{c.totalAthletes}</span>
              </td>
              <td className="px-4 py-3 text-center">
                <span className="rounded bg-indigo-900/30 px-2 py-0.5 text-indigo-300 font-medium">{c.totalPlans}</span>
              </td>
              <td className="px-4 py-3 text-center">
                <span className="rounded bg-[#2A2D3A] px-2 py-0.5 text-[#F1F5F9] font-medium">{c.totalNotes}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────────

export default function ReportesClient({ defaultPeriod, initialMeta, initialData }: Props) {
  const [activeTab, setActiveTab] = useState<ActiveTab>(defaultPeriod);
  const [meta,      setMeta]      = useState<ReportPeriodMeta>(initialMeta);
  const [data,      setData]      = useState<ReportData>(initialData);
  const [loading,   setLoading]   = useState(false);

  // Custom date range state
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Mexico_City' });
  const [customFrom, setCustomFrom] = useState<string>(today);
  const [customTo,   setCustomTo]   = useState<string>(today);

  // Refetch when preset period changes (skip on first mount)
  useEffect(() => {
    if (activeTab === 'custom' || activeTab === defaultPeriod) return;
    const p = activeTab as ReportPeriodKey;
    const m = getReportPeriodRange(p);
    setMeta(m);
    setLoading(true);
    fetchReportData(m.from, m.to).then((d) => {
      setData(d);
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // Apply custom date range
  function handleApplyCustom() {
    if (!customFrom || !customTo || customFrom > customTo) return;
    const customMeta: ReportPeriodMeta = {
      from:        customFrom,
      to:          customTo,
      label:       `${fmtDisplay(customFrom)} – ${fmtDisplay(customTo)}`,
      reportTitle: 'REPORTE PERSONALIZADO',
    };
    setMeta(customMeta);
    setLoading(true);
    fetchReportData(customFrom, customTo).then((d) => {
      setData(d);
      setLoading(false);
    });
  }

  // Summary KPIs for the services section
  const totalScheduled  = data.services.reduce((s, r) => s + r.scheduled,          0);
  const totalAttended   = data.services.reduce((s, r) => s + r.attendedPresential,  0);
  const totalNoShow     = data.services.reduce((s, r) => s + r.noShow,              0);
  const totalNotes      = data.services.reduce((s, r) => s + r.followUpNotes,       0);

  return (
    <div className="min-h-screen bg-[#0F1117] text-[#F1F5F9]">
      {/* ── Fixed header ── */}
      <header className="fixed top-0 left-0 right-0 z-50 h-16 flex items-center justify-between px-6
                         bg-[#0F1117]/95 backdrop-blur border-b border-[#2A2D3A] no-print">
        {/* Logo + back */}
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/Logo AO Deporte.png" alt="AO Deporte" className="h-9 w-auto" />
          <div>
            <span className="text-[#94A3B8] text-xs">Reportes</span>
          </div>
          <Link
            href="/admin"
            className="ml-2 text-xs text-[#94A3B8] hover:text-[#F1F5F9] transition-colors
                       px-2 py-1 rounded hover:bg-[#2A2D3A]"
          >
            ← Admin
          </Link>
        </div>

        {/* Period picker */}
        <nav className="flex items-center gap-1 bg-[#1A1D27] rounded-lg p-1">
          {PERIODS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                activeTab === key
                  ? 'bg-indigo-600 text-white'
                  : 'text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-[#2A2D3A]'
              }`}
            >
              {label}
            </button>
          ))}
          <button
            onClick={() => setActiveTab('custom')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1 ${
              activeTab === 'custom'
                ? 'bg-indigo-600 text-white'
                : 'text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-[#2A2D3A]'
            }`}
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Personalizado
          </button>
        </nav>

        {/* Print button */}
        <button
          onClick={() => triggerPrint(data, meta)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1A1D27] border border-[#2A2D3A]
                     text-xs font-medium text-[#94A3B8] hover:text-[#F1F5F9] hover:border-indigo-500/40
                     hover:bg-indigo-600/10 transition-all"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
          Imprimir
        </button>
      </header>

      {/* ── Custom date range panel (shown below header when Personalizado is active) ── */}
      {activeTab === 'custom' && (
        <div className="fixed top-16 left-0 right-0 z-40 border-b border-[#2A2D3A]
                        bg-[#1A1D27]/98 backdrop-blur px-6 py-3 no-print">
          <div className="max-w-screen-xl mx-auto flex flex-wrap items-end gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wide">
                Fecha inicio
              </label>
              <input
                type="date"
                value={customFrom}
                max={customTo || undefined}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="bg-[#0F1117] border border-[#2A2D3A] text-[#F1F5F9] text-sm rounded-lg
                           px-3 py-1.5 focus:outline-none focus:border-indigo-500
                           [color-scheme:dark] cursor-pointer"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wide">
                Fecha fin
              </label>
              <input
                type="date"
                value={customTo}
                min={customFrom || undefined}
                onChange={(e) => setCustomTo(e.target.value)}
                className="bg-[#0F1117] border border-[#2A2D3A] text-[#F1F5F9] text-sm rounded-lg
                           px-3 py-1.5 focus:outline-none focus:border-indigo-500
                           [color-scheme:dark] cursor-pointer"
              />
            </div>

            <button
              onClick={handleApplyCustom}
              disabled={!customFrom || !customTo || customFrom > customTo || loading}
              className="px-5 py-1.5 rounded-lg bg-indigo-600 text-white text-sm font-medium
                         hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed
                         transition-colors"
            >
              {loading ? 'Cargando…' : 'Aplicar'}
            </button>

            {customFrom && customTo && customFrom <= customTo && (
              <span className="text-xs text-[#94A3B8] self-center">
                {fmtDisplay(customFrom)} – {fmtDisplay(customTo)}
              </span>
            )}
            {customFrom && customTo && customFrom > customTo && (
              <span className="text-xs text-red-400 self-center">
                La fecha de inicio no puede ser posterior a la fecha fin
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── Main content ── */}
      <main className={`px-4 md:px-6 pb-12 max-w-screen-xl mx-auto space-y-6 ${
        activeTab === 'custom' ? 'pt-36' : 'pt-20'
      }`}>

        {/* Report title */}
        <div className="flex items-end justify-between pt-2">
          <div>
            <h1 className="text-xl font-bold text-[#F1F5F9]">{meta.reportTitle}</h1>
            <p className="text-sm text-[#94A3B8] mt-0.5">Resumen Metas Plataforma · {meta.label}</p>
          </div>
          <div className="text-xs text-[#94A3B8]">
            Atletas activos: <span className="text-[#F1F5F9] font-bold text-base ml-1">{data.activeAthletes}</span>
          </div>
        </div>

        {/* ── Section 1: Health Services ── */}
        <section>
          <div className="flex items-center gap-3 mb-3">
            <h2 className="text-sm font-semibold text-[#F1F5F9] uppercase tracking-wide">
              Servicios de Salud
            </h2>
            <div className="flex-1 h-px bg-[#2A2D3A]" />
          </div>

          {/* Summary KPI cards */}
          {!loading && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
              <StatCard label="Citas Programadas"     value={totalScheduled} />
              <StatCard label="Atendidas Presencial"  value={totalAttended}  accent />
              <StatCard label="Notas de Seguimiento"  value={totalNotes} />
              <StatCard label="No Atendidas"          value={totalNoShow} />
            </div>
          )}

          <ServiceTable rows={data.services} loading={loading} />
        </section>

        {/* ── Section 2: Coaches ── */}
        <section>
          <div className="flex items-center gap-3 mb-3">
            <h2 className="text-sm font-semibold text-[#F1F5F9] uppercase tracking-wide">
              Entrenadores
            </h2>
            <div className="flex-1 h-px bg-[#2A2D3A]" />
            <span className="text-xs text-[#94A3B8] shrink-0">
              Atletas y planes: acumulado total &nbsp;·&nbsp; Seguimientos: {meta.label}
            </span>
          </div>
          <CoachTable rows={data.coaches} loading={loading} />
        </section>

        {/* ── Section 3: Staff Médico (por miembro) ── */}
        <section>
          <div className="flex items-center gap-3 mb-3">
            <h2 className="text-sm font-semibold text-[#F1F5F9] uppercase tracking-wide">
              Staff Médico
            </h2>
            <div className="flex-1 h-px bg-[#2A2D3A]" />
            <span className="text-xs text-[#94A3B8] shrink-0">
              Por miembro del equipo · {meta.label}
            </span>
          </div>
          <StaffMemberTable rows={data.staffMembers} loading={loading} />
        </section>

        {/* ── Section 4: Por Disciplina ── */}
        <section>
          <div className="flex items-center gap-3 mb-3">
            <h2 className="text-sm font-semibold text-[#F1F5F9] uppercase tracking-wide">
              Por Disciplina
            </h2>
            <div className="flex-1 h-px bg-[#2A2D3A]" />
            <span className="text-xs text-[#94A3B8] shrink-0">
              Citas: {meta.label} · Planes: acumulado
            </span>
          </div>
          <DisciplineTable rows={data.disciplines} loading={loading} />
        </section>

      </main>
    </div>
  );
}
