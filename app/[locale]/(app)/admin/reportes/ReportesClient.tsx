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
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
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
  .narrative-section {
    margin: 12px 0 20px;
    padding: 12px 16px;
    border-left: 3px solid #6366f1;
    background: #f8f9fa;
    page-break-inside: avoid;
  }
  .narrative-label {
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #6366f1;
    margin: 0 0 6px;
  }
  .narrative-section p {
    margin: 0 0 6px;
    font-size: 10.5px;
    line-height: 1.65;
    color: #1f2937;
  }
  .narrative-section p:last-child { margin-bottom: 0; }
  .charts-row {
    display: flex;
    gap: 10px;
    margin: 6px 0 10px;
    page-break-inside: avoid;
  }
  .charts-row > div { min-width: 0; }
  .chart-wrap {
    max-width: 65%;
    margin: 6px 0 10px;
    page-break-inside: avoid;
  }
  .chart-wrap-full {
    width: 100%;
    margin: 6px 0 10px;
    page-break-inside: avoid;
  }
  .charts-row svg,
  .chart-wrap svg,
  .chart-wrap-full svg { display: block; width: 100%; height: auto; }
  .notes-section {
    margin: 4px 0 0;
    padding: 10px 14px;
    border: 1px solid #d1d5db;
    border-radius: 4px;
    min-height: 60px;
    font-size: 10.5px;
    line-height: 1.65;
    color: #1f2937;
    white-space: pre-wrap;
    word-break: break-word;
  }
`;

function buildPrintDocument(
  data: ReportData,
  meta: ReportPeriodMeta,
  logoUrl: string,
  narrative?: string,
  charts?: Record<string, string>,
  notes?: string,
): string {
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

  // Helper: embed a chart inside a constrained wrapper
  function chartBlock(id: string, fullWidth = false): string {
    const svgHtml = charts?.[id];
    if (!svgHtml) return '';
    return `<div class="${fullWidth ? 'chart-wrap-full' : 'chart-wrap'}">${svgHtml}</div>`;
  }

  // Service charts: pie + bar side-by-side (mirrors on-screen 1fr/2fr grid)
  const serviceChartsHtml = (() => {
    const pie = charts?.['chart-attendance-pie'];
    const bar = charts?.['chart-services-bar'];
    if (!pie && !bar) return '';
    if (pie && bar) {
      return `<div class="charts-row">
        <div style="flex:1.2">${pie}</div>
        <div style="flex:2">${bar}</div>
      </div>`;
    }
    return `<div class="chart-wrap">${pie ?? bar}</div>`;
  })();

  // Helper: render narrative paragraphs
  const narrativeHtml = narrative
    ? `<div class="narrative-section">
        <div class="narrative-label">Narrativa Ejecutiva &middot; Generada con IA</div>
        ${narrative
          .split(/\n{2,}/)
          .map((p) => `<p>${p.trim()}</p>`)
          .join('')}
      </div>`
    : '';

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

  ${narrativeHtml}

  <div class="section-title">Servicios de Salud</div>
  ${serviceChartsHtml}
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
  ${chartBlock('chart-coaches-bar')}
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
  ${chartBlock('chart-disciplines-bar', true)}
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

  ${notes?.trim() ? `
  <div class="section-title" style="margin-top:20px">Notas Adicionales</div>
  <div class="notes-section">${notes.trim().replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>` : ''}

  <div class="print-footer">
    Sistema AO Deportes &middot; aodeporte.com &middot; Impreso: ${today}
  </div>
</body>
</html>`;
}

/** Serializes each Recharts SVG for inline embedding in the print document.
 *
 * Recharts does not set a viewBox on its SVGs — it uses fixed pixel width/height.
 * Without a viewBox, percentage-based widths don't scale the content correctly.
 * We capture the real rendered dimensions, add viewBox, then set width="100%"
 * so the SVG fills its container and scales properly regardless of iframe size.
 */
function captureCharts(): Record<string, string> {
  const ids = [
    'chart-attendance-pie',
    'chart-services-bar',
    'chart-coaches-bar',
    'chart-disciplines-bar',
  ];
  const result: Record<string, string> = {};
  for (const id of ids) {
    const el = document.getElementById(id);
    if (!el) continue;
    const svg = el.querySelector('svg');
    if (!svg) continue;
    const rect = svg.getBoundingClientRect();
    const w = Math.round(rect.width);
    const h = Math.round(rect.height);
    if (w === 0 || h === 0) continue;   // chart not yet rendered

    const cloned = svg.cloneNode(true) as SVGElement;
    cloned.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    // viewBox locks the internal coordinate space to the original pixel dimensions
    cloned.setAttribute('viewBox', `0 0 ${w} ${h}`);
    // width="100%" + height="auto" (via CSS) lets the SVG fill its container
    // while preserving the aspect ratio defined by viewBox
    cloned.setAttribute('width', '100%');
    cloned.removeAttribute('height');
    result[id] = cloned.outerHTML;
  }
  return result;
}

function triggerPrint(
  data: ReportData,
  meta: ReportPeriodMeta,
  narrative?: string,
  notes?: string,
) {
  const charts = captureCharts();

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
  doc.write(buildPrintDocument(data, meta, logoUrl, narrative, charts, notes));
  doc.close();

  // Guard against double-print: onload + setTimeout both racing to call print()
  let printed = false;
  const doPrint = () => {
    if (printed) return;
    printed = true;
    iframe!.onload = null;
    iframe!.contentWindow?.focus();
    iframe!.contentWindow?.print();
  };

  iframe.onload = doPrint;
  // Fallback for browsers that fire onload before doc.write completes
  setTimeout(doPrint, 500);
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

// ─── Chart palette & shared config ────────────────────────────────────────────

const CHT = {
  scheduled:  '#6366f1',
  presential: '#34d399',
  remote:     '#60a5fa',
  noShow:     '#f87171',
  plans:      '#a78bfa',
  notes:      '#94a3b8',
  athletes:   '#2dd4bf',
};

const TOOLTIP_STYLE = {
  background:   '#1A1D27',
  border:       '1px solid #2A2D3A',
  borderRadius: 8,
  color:        '#F1F5F9',
  fontSize:     12,
};

const A_TICK  = { fill: '#94A3B8', fontSize: 11 };
const LEG_STY = { fontSize: 11, color: '#94A3B8', paddingTop: 6 };

// ─── Chart: attendance donut ──────────────────────────────────────────────────

function AttendancePieChart({
  presential, remote, noShow, id,
}: { presential: number; remote: number; noShow: number; id?: string }) {
  const slices = [
    { name: 'Presencial',   value: presential, color: CHT.presential },
    { name: 'Remoto',       value: remote,     color: CHT.remote     },
    { name: 'No Atendidas', value: noShow,     color: CHT.noShow     },
  ].filter(s => s.value > 0);

  if (slices.length === 0) return null;

  return (
    <div id={id} className="rounded-xl border border-[#2A2D3A] bg-[#0F1117] p-4 flex flex-col">
      <p className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wide mb-1">
        Distribución de Citas
      </p>
      <ResponsiveContainer width="100%" height={190}>
        <PieChart>
          <Pie
            data={slices}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={52}
            outerRadius={78}
            paddingAngle={3}
          >
            {slices.map(s => (
              <Cell key={s.name} fill={s.color} stroke="transparent" />
            ))}
          </Pie>
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          <Legend iconType="circle" wrapperStyle={LEG_STY} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Chart: citas por servicio (grouped bar) ──────────────────────────────────

function ServicesBarChart({ rows, id }: { rows: ReportServiceRow[]; id?: string }) {
  if (rows.length === 0) return null;
  const chartData = rows.map(r => ({
    name:           r.service,
    Programadas:    r.scheduled,
    Presencial:     r.attendedPresential,
    Remoto:         r.attendedRemote ?? 0,
    'No Atendidas': r.noShow,
  }));
  return (
    <div id={id} className="rounded-xl border border-[#2A2D3A] bg-[#0F1117] p-4">
      <p className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wide mb-3">
        Citas por Servicio
      </p>
      <ResponsiveContainer width="100%" height={190}>
        <BarChart data={chartData} barCategoryGap="30%" barGap={3}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2A2D3A" vertical={false} />
          <XAxis dataKey="name" tick={A_TICK} axisLine={false} tickLine={false} />
          <YAxis tick={A_TICK} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          <Legend iconType="square" wrapperStyle={LEG_STY} />
          <Bar dataKey="Programadas"   fill={CHT.scheduled}  radius={[3,3,0,0]} />
          <Bar dataKey="Presencial"    fill={CHT.presential} radius={[3,3,0,0]} />
          <Bar dataKey="Remoto"        fill={CHT.remote}     radius={[3,3,0,0]} />
          <Bar dataKey="No Atendidas"  fill={CHT.noShow}     radius={[3,3,0,0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Chart: entrenadores (grouped bar) ───────────────────────────────────────

function CoachesBarChart({ rows, id }: { rows: ReportCoachRow[]; id?: string }) {
  if (rows.length === 0) return null;
  const chartData = rows.map(c => ({
    name:             c.discipline,
    'Atletas c/Plan': c.totalAthletes,
    Planes:           c.totalPlans,
    Seguimientos:     c.totalNotes,
  }));
  return (
    <div id={id} className="rounded-xl border border-[#2A2D3A] bg-[#0F1117] p-4 mb-4">
      <p className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wide mb-3">
        Resumen por Entrenador
      </p>
      <ResponsiveContainer width="100%" height={190}>
        <BarChart data={chartData} barCategoryGap="30%" barGap={3}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2A2D3A" vertical={false} />
          <XAxis dataKey="name" tick={A_TICK} axisLine={false} tickLine={false} />
          <YAxis tick={A_TICK} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          <Legend iconType="square" wrapperStyle={LEG_STY} />
          <Bar dataKey="Atletas c/Plan" fill={CHT.athletes}  radius={[3,3,0,0]} />
          <Bar dataKey="Planes"         fill={CHT.plans}     radius={[3,3,0,0]} />
          <Bar dataKey="Seguimientos"   fill={CHT.notes}     radius={[3,3,0,0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Chart: atletas por disciplina (horizontal bar) ───────────────────────────

function DisciplinesBarChart({ rows, id }: { rows: ReportDisciplineRow[]; id?: string }) {
  if (rows.length === 0) return null;
  const chartData = rows.map(d => ({
    name:            d.disciplineName,
    Total:           d.totalAthletes,
    Asistieron:      d.athletesAttended,
    'No Asistieron': d.athletesNoShow,
    'Con Plan':      d.athletesWithPlans,
  }));
  const height = Math.max(200, chartData.length * 40 + 60);
  return (
    <div id={id} className="rounded-xl border border-[#2A2D3A] bg-[#0F1117] p-4 mb-4">
      <p className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wide mb-3">
        Atletas por Disciplina
      </p>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={chartData} layout="vertical" barCategoryGap="25%" barGap={2}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2A2D3A" horizontal={false} />
          <XAxis type="number" tick={A_TICK} axisLine={false} tickLine={false} allowDecimals={false} />
          <YAxis
            type="category"
            dataKey="name"
            tick={A_TICK}
            axisLine={false}
            tickLine={false}
            width={110}
          />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          <Legend iconType="square" wrapperStyle={LEG_STY} />
          <Bar dataKey="Total"          fill={CHT.scheduled}  radius={[0,3,3,0]} />
          <Bar dataKey="Asistieron"     fill={CHT.presential} radius={[0,3,3,0]} />
          <Bar dataKey="No Asistieron"  fill={CHT.noShow}     radius={[0,3,3,0]} />
          <Bar dataKey="Con Plan"       fill={CHT.plans}      radius={[0,3,3,0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────────

type NarrativeStatus = 'idle' | 'generating' | 'review' | 'approved' | 'error';

export default function ReportesClient({ defaultPeriod, initialMeta, initialData }: Props) {
  const [activeTab, setActiveTab] = useState<ActiveTab>(defaultPeriod);
  const [meta,      setMeta]      = useState<ReportPeriodMeta>(initialMeta);
  const [data,      setData]      = useState<ReportData>(initialData);
  const [loading,   setLoading]   = useState(false);

  // Custom date range state
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Mexico_City' });
  const [customFrom, setCustomFrom] = useState<string>(today);
  const [customTo,   setCustomTo]   = useState<string>(today);

  // Narrative state
  const [narrativeText,   setNarrativeText]   = useState<string | null>(null);
  const [narrativeStatus, setNarrativeStatus] = useState<NarrativeStatus>('idle');
  const [narrativeError,  setNarrativeError]  = useState<string | null>(null);

  // Editable notes state (persists across period changes)
  const [notes, setNotes] = useState<string>('');

  /** Reset narrative whenever the data period changes. */
  function resetNarrative() {
    setNarrativeText(null);
    setNarrativeStatus('idle');
    setNarrativeError(null);
  }

  /** Call the API route and update narrative state. */
  async function generateNarrative() {
    setNarrativeStatus('generating');
    setNarrativeError(null);
    try {
      const res = await fetch('/api/admin/generate-report-narrative', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data, meta }),
      });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: 'Error desconocido' }));
        throw new Error(error ?? 'Error del servidor');
      }
      const { narrative } = await res.json();
      setNarrativeText(narrative);
      setNarrativeStatus('review');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'No se pudo generar la narrativa.';
      setNarrativeError(msg);
      setNarrativeStatus('error');
    }
  }

  // Refetch when preset period changes (skip on first mount)
  useEffect(() => {
    if (activeTab === 'custom' || activeTab === defaultPeriod) return;
    const p = activeTab as ReportPeriodKey;
    const m = getReportPeriodRange(p);
    setMeta(m);
    setLoading(true);
    resetNarrative();
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
    resetNarrative();
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
  const totalRemote     = data.services.reduce((s, r) => s + (r.attendedRemote ?? 0), 0);

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

        {/* Generar Narrativa IA button */}
        <button
          onClick={generateNarrative}
          disabled={loading || narrativeStatus === 'generating'}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-xs font-medium transition-all
                     disabled:opacity-40 disabled:cursor-not-allowed ${
            narrativeStatus === 'approved'
              ? 'bg-indigo-600/15 border-indigo-500/50 text-indigo-300'
              : 'bg-[#1A1D27] border-[#2A2D3A] text-[#94A3B8] hover:text-[#F1F5F9] hover:border-indigo-500/40 hover:bg-indigo-600/10'
          }`}
        >
          {narrativeStatus === 'generating' ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Generando…
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              {narrativeStatus === 'approved' ? 'Narrativa aprobada' : 'Generar Narrativa IA'}
            </>
          )}
        </button>

        {/* Print button */}
        <button
          onClick={() => triggerPrint(data, meta, undefined, notes)}
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

        {/* ── AI Narrative Section ── */}
        {narrativeStatus !== 'idle' && (
          <section className="rounded-xl border border-[#2A2D3A] bg-[#1A1D27] p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-semibold text-indigo-400 uppercase tracking-wide">
                Narrativa Ejecutiva · IA
              </span>
              {narrativeStatus === 'approved' && (
                <span className="flex items-center gap-1 text-xs text-emerald-400">
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Aprobada
                </span>
              )}
            </div>

            {narrativeStatus === 'generating' && (
              <div className="space-y-2 animate-pulse">
                <div className="h-3.5 bg-[#2A2D3A] rounded w-3/4" />
                <div className="h-3.5 bg-[#2A2D3A] rounded w-full" />
                <div className="h-3.5 bg-[#2A2D3A] rounded w-5/6" />
                <div className="h-3.5 bg-[#2A2D3A] rounded w-4/5 mt-3" />
                <div className="h-3.5 bg-[#2A2D3A] rounded w-full" />
                <div className="h-3.5 bg-[#2A2D3A] rounded w-2/3 mt-3" />
                <div className="h-3.5 bg-[#2A2D3A] rounded w-5/6" />
                <p className="text-xs text-[#64748B] mt-3 text-center">Analizando indicadores con Claude…</p>
              </div>
            )}

            {(narrativeStatus === 'review' || narrativeStatus === 'approved') && narrativeText && (
              <div className="space-y-4">
                <div className="text-sm text-[#E2E8F0] leading-relaxed whitespace-pre-wrap">
                  {narrativeText}
                </div>

                {narrativeStatus === 'review' && (
                  <div className="flex items-center gap-3 pt-3 border-t border-[#2A2D3A]">
                    <button
                      onClick={() => setNarrativeStatus('approved')}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 text-white
                                 text-xs font-medium hover:bg-emerald-500 transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Aprobar
                    </button>
                    <button
                      onClick={generateNarrative}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#2A2D3A]
                                 text-[#94A3B8] text-xs font-medium hover:text-[#F1F5F9]
                                 hover:bg-[#3A3D4A] transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Regenerar
                    </button>
                    <button
                      onClick={resetNarrative}
                      className="text-xs text-[#64748B] hover:text-[#94A3B8] transition-colors ml-auto"
                    >
                      Descartar
                    </button>
                  </div>
                )}

                {narrativeStatus === 'approved' && (
                  <div className="flex items-center gap-3 pt-3 border-t border-[#2A2D3A]">
                    <button
                      onClick={() => triggerPrint(data, meta, narrativeText ?? undefined, notes)}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white
                                 text-xs font-medium hover:bg-indigo-500 transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                      </svg>
                      Imprimir con Narrativa
                    </button>
                    <button
                      onClick={() => setNarrativeStatus('review')}
                      className="text-xs text-[#64748B] hover:text-[#94A3B8] transition-colors"
                    >
                      Editar narrativa
                    </button>
                  </div>
                )}
              </div>
            )}

            {narrativeStatus === 'error' && (
              <div className="flex flex-col gap-3">
                <p className="text-sm text-red-400">{narrativeError}</p>
                <div className="flex items-center gap-3">
                  <button
                    onClick={generateNarrative}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#2A2D3A]
                               text-[#94A3B8] text-xs font-medium hover:text-[#F1F5F9]
                               hover:bg-[#3A3D4A] transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Reintentar
                  </button>
                  <button
                    onClick={resetNarrative}
                    className="text-xs text-[#64748B] hover:text-[#94A3B8] transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </section>
        )}

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

          {/* Charts: donut + grouped bar */}
          {!loading && data.services.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-3 mb-4">
              <AttendancePieChart
                presential={totalAttended}
                remote={totalRemote}
                noShow={totalNoShow}
                id="chart-attendance-pie"
              />
              <ServicesBarChart rows={data.services} id="chart-services-bar" />
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
          {!loading && <CoachesBarChart rows={data.coaches} id="chart-coaches-bar" />}
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
          {!loading && <DisciplinesBarChart rows={data.disciplines} id="chart-disciplines-bar" />}
          <DisciplineTable rows={data.disciplines} loading={loading} />
        </section>

        {/* ── Notes Section ── */}
        <section>
          <div className="flex items-center gap-3 mb-3">
            <h2 className="text-sm font-semibold text-[#F1F5F9] uppercase tracking-wide">
              Notas Adicionales
            </h2>
            <div className="flex-1 h-px bg-[#2A2D3A]" />
            <span className="text-xs text-[#94A3B8] shrink-0">Se incluyen en la impresión</span>
          </div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Agrega observaciones o comentarios que se imprimirán junto con el reporte…"
            rows={4}
            className="w-full bg-[#1A1D27] border border-[#2A2D3A] text-[#E2E8F0] text-sm
                       rounded-xl px-4 py-3 focus:outline-none focus:border-indigo-500/50
                       resize-none placeholder:text-[#4A5568] transition-colors"
          />
        </section>

      </main>
    </div>
  );
}
