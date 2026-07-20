import { notFound }            from 'next/navigation';
import { requireAdminAccess }   from '@/lib/rbac/server';
import { getActivityForReport } from '@/lib/bitacora/queries';
import { PrintControls }        from '@/components/bitacora/PrintControls';
import type { ReportAthlete }   from '@/lib/types/bitacora';

// =============================================================================
// Constantes del proveedor
// =============================================================================
const P = {
  razon_social:  'Comercializadora Arystan, S.A. de C.V.',
  contrato:      'CAAPS/26-04-005',
  rfc:           'CAR220708NL9',
  servicio:      'Servicio Integral Técnico Especializado para el Fortalecimiento al Deporte',
  domicilio_1:   'Mariano Escobedo 476, Piso 12, Col. Anzures, CP11590',
  domicilio_2:   'Alc. Miguel Hidalgo, Ciudad de México',
  administrador: 'C. Alejandra Cortez Ortiz',
  cargo:         'Administrador Único',
  alcaldia:      'ALCALDÍA ÁLVARO OBREGÓN',
};

// =============================================================================
// Helpers
// =============================================================================

function calcEdad(fechaNac: string | null): number | null {
  if (!fechaNac) return null;
  const hoy = new Date();
  const nac = new Date(fechaNac + 'T12:00:00');
  let edad = hoy.getFullYear() - nac.getFullYear();
  const m = hoy.getMonth() - nac.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) edad--;
  return edad;
}

function fmtFecha(d: string | null): string {
  if (!d) return '—';
  return new Date(d + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
}

function fmtFechaNac(d: string | null): string {
  if (!d) return '—';
  return new Date(d + 'T12:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function semanaPeriodo(dateStr: string | null): string {
  if (!dateStr) return '—';
  const d   = new Date(dateStr + 'T12:00:00');
  const dow = d.getDay();
  const lunes  = new Date(d); lunes.setDate(d.getDate() - ((dow + 6) % 7));
  const sabado = new Date(lunes); sabado.setDate(lunes.getDate() + 5);
  const o: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long' };
  return `Semana del ${lunes.toLocaleDateString('es-MX', o)} al ${sabado.toLocaleDateString('es-MX', o)}`;
}

function hoy(): string {
  return new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
}

function v(val: string | null | number | undefined, fallback = '—'): string {
  if (val === null || val === undefined || val === '') return fallback;
  return String(val);
}

// =============================================================================
// Estilos de celda compartidos
// =============================================================================
const TD_LABEL: React.CSSProperties = {
  border: '1px solid #c8c8c8',
  padding: '5px 8px',
  fontSize: '9pt',
  verticalAlign: 'middle',
  backgroundColor: '#ebebeb',
  width: '22%',
};
const TD_VALUE: React.CSSProperties = {
  border: '1px solid #c8c8c8',
  padding: '5px 8px',
  fontSize: '9pt',
  verticalAlign: 'top',
};
const TD_LABEL_R: React.CSSProperties = { ...TD_LABEL, width: '18%' };
const TD_VALUE_R: React.CSSProperties = { ...TD_VALUE, width: '38%' };

// =============================================================================
// Sub-componentes de diseño
// =============================================================================

/** Decoración tipo ola en la esquina superior derecha (SVG inline, sin imagen externa) */
function WaveDecor() {
  return (
    <svg
      width="200" height="88"
      viewBox="0 0 200 88"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'block' }}
    >
      {/* Ola exterior — naranja */}
      <path d="M 200 0 C 140 0 80 30 20 88 L 200 88 Z" fill="#F26522"/>
      {/* Ola interior — rojo-coral */}
      <path d="M 200 0 C 165 10 140 45 120 88 L 200 88 Z" fill="#C0392B"/>
    </svg>
  );
}

/** Cabecera de página: logo izquierda + ola derecha */
function PageHeader() {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: '18pt',
      borderBottom: '2px solid #e0e0e0',
      paddingBottom: '0',
    }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/arystan-logo.png"
        alt="Arystan"
        style={{ height: '52pt', width: 'auto', objectFit: 'contain' }}
      />
      <WaveDecor />
    </div>
  );
}

/** Sección de título: nombre del doc (izquierda) + nombre evento + fecha (derecha) */
function DocTitle({
  titulo, eventName, fecha,
}: { titulo: string; eventName: string; fecha: string }) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: '12pt',
    }}>
      <h1 style={{
        fontSize: '22pt',
        fontWeight: 'normal',
        margin: 0,
        lineHeight: 1.15,
        maxWidth: '55%',
      }}>
        {titulo}
      </h1>
      <div style={{ textAlign: 'right' }}>
        <p style={{ fontSize: '11pt', fontWeight: 'bold', margin: 0 }}>{eventName}</p>
        <p style={{ fontSize: '9pt', margin: '4pt 0 0', color: '#444' }}>
          Fecha&nbsp;&nbsp;{fecha}
        </p>
      </div>
    </div>
  );
}

/** Etiqueta de sección (negrita, igual que en los PDFs) */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontWeight: 'bold', fontSize: '9.5pt', marginBottom: '5pt', marginTop: '10pt' }}>
      {children}
    </p>
  );
}

/** Firma */
function Firma() {
  return (
    <div style={{ marginTop: '30pt', fontSize: '9.5pt' }}>
      <p style={{ margin: '0 0 20pt' }}>Atentamente,</p>
      <p style={{ fontWeight: 'bold', margin: 0 }}>{P.administrador}</p>
      <p style={{ fontWeight: 'bold', margin: 0 }}>{P.cargo}</p>
    </div>
  );
}

/** Tabla de metadatos de la actividad (formato 4 columnas igual al PDF) */
type Act = NonNullable<Awaited<ReturnType<typeof getActivityForReport>>['activity']>;

function MetaTable({
  activity, athletes, showBeneficiarios = false,
}: {
  activity: Act;
  athletes: ReportAthlete[];
  showBeneficiarios?: boolean;
}) {
  const nombresList = athletes.map((a) => `${a.athlete_code ?? ''} ${a.first_name} ${a.last_name}`.trim());
  const mid = Math.ceil(nombresList.length / 2);
  const col1Names = nombresList.slice(0, mid);
  const col2Names = nombresList.slice(mid);

  const T = { borderCollapse: 'collapse' as const, width: '100%', fontSize: '9pt' };

  return (
    <table style={T}>
      {/* Disciplina / Especialidad */}
      <tbody>
        <tr>
          <td style={TD_LABEL}>Disciplina:</td>
          <td style={TD_VALUE}>{v(activity.disciplina)}</td>
          <td style={TD_LABEL_R}>Especialidad</td>
          <td style={TD_VALUE_R}>{v(activity.especialidad)}</td>
        </tr>

        {/* Actividad (rowspan=2) / Sede + Fecha */}
        <tr>
          <td style={{ ...TD_LABEL, verticalAlign: 'top' }} rowSpan={2}>Actividad:</td>
          <td style={{ ...TD_VALUE, verticalAlign: 'top' }} rowSpan={2}>
            {v(activity.actividad_tipo)}
          </td>
          <td style={TD_LABEL_R}>Sede</td>
          <td style={TD_VALUE_R}>{v(activity.sede ?? activity.location)}</td>
        </tr>
        <tr>
          <td style={TD_LABEL_R}>Fecha</td>
          <td style={TD_VALUE_R}>{fmtFecha(activity.event_date)}</td>
        </tr>

        {/* Horario / Número de participantes */}
        <tr>
          <td style={TD_LABEL}>Horario</td>
          <td style={TD_VALUE}>{v(activity.horario)}</td>
          <td style={TD_LABEL_R}>Número de participantes:</td>
          <td style={TD_VALUE_R}>{v(activity.numero_participantes)}</td>
        </tr>

        {/* Beneficiarios y Población objetivo (solo Bitácora y Ficha) */}
        {showBeneficiarios && (
          <>
            <tr>
              <td style={TD_LABEL}>Beneficiarios:</td>
              <td colSpan={3} style={TD_VALUE}>
                {nombresList.length === 0 ? '—' : (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
                    <div>{col1Names.map((n) => <div key={n}>{n}</div>)}</div>
                    <div>{col2Names.map((n) => <div key={n}>{n}</div>)}</div>
                  </div>
                )}
              </td>
            </tr>
            <tr>
              <td style={TD_LABEL}>Población objetivo:</td>
              <td colSpan={3} style={TD_VALUE}>
                {nombresList.length === 0 ? '—' : (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
                    <div>{col1Names.map((n) => <div key={n}>{n}</div>)}</div>
                    <div>{col2Names.map((n) => <div key={n}>{n}</div>)}</div>
                  </div>
                )}
              </td>
            </tr>
          </>
        )}

        {/* Requerimiento / Objetivo */}
        <tr>
          <td style={TD_LABEL}>Requerimiento</td>
          <td style={TD_VALUE}>{v(activity.requerimiento)}</td>
          <td style={TD_LABEL_R}>Objetivo:</td>
          <td style={TD_VALUE_R}>{v(activity.objetivo)}</td>
        </tr>

        {/* Personal / Equipo */}
        <tr>
          <td style={TD_LABEL}>Personal requerido</td>
          <td style={TD_VALUE}>{v(activity.personal_requerido, 'Ninguno')}</td>
          <td style={TD_LABEL_R}>Equipo requerido:</td>
          <td style={TD_VALUE_R}>{v(activity.equipo_requerido, 'Ninguno')}</td>
        </tr>
      </tbody>
    </table>
  );
}

/** Tabla de Beneficiarios con datos demográficos (Base de Datos) */
function BeneficiariosDemoTable({ athletes }: { athletes: ReportAthlete[] }) {
  const TH: React.CSSProperties = {
    border: '1px solid #c8c8c8',
    padding: '3px 4px',
    fontSize: '7.5pt',
    backgroundColor: '#ebebeb',
    fontWeight: 'bold',
    textAlign: 'left',
  };
  const TD: React.CSSProperties = {
    border: '1px solid #c8c8c8',
    padding: '3px 4px',
    fontSize: '7.5pt',
    verticalAlign: 'top',
    wordBreak: 'break-word',
  };

  return (
    <table style={{ borderCollapse: 'collapse', width: '100%', tableLayout: 'fixed', fontSize: '7.5pt' }}>
      <colgroup>
        <col style={{ width: '6%'   }} />{/* Folio */}
        <col style={{ width: '8%'   }} />{/* Nombre */}
        <col style={{ width: '10%'  }} />{/* Apellido */}
        <col style={{ width: '8%'   }} />{/* Disciplina */}
        <col style={{ width: '4%'   }} />{/* Sexo */}
        <col style={{ width: '7%'   }} />{/* Fecha Nac */}
        <col style={{ width: '4%'   }} />{/* Edad */}
        <col style={{ width: '19%'  }} />{/* CURP */}
        <col style={{ width: '5%'   }} />{/* CP */}
        <col style={{ width: '14%'  }} />{/* Colonia */}
        <col style={{ width: '15%'  }} />{/* Teléfono */}
      </colgroup>
      <thead>
        <tr>
          {['Folio','Nombre','Apellido','Disciplina','Sexo','Fecha de nacimiento','Edad','CURP','CP','Colonia','Teléfono']
            .map((h) => <th key={h} style={TH}>{h}</th>)}
        </tr>
      </thead>
      <tbody>
        {athletes.length === 0 ? (
          <tr><td colSpan={11} style={{ ...TD, textAlign: 'center', color: '#888' }}>Sin beneficiarios</td></tr>
        ) : athletes.map((a) => (
          <tr key={a.athlete_id}>
            <td style={TD}>{v(a.athlete_code)}</td>
            <td style={TD}>{a.first_name}</td>
            <td style={TD}>{a.last_name}</td>
            <td style={TD}>{v(a.discipline)}</td>
            <td style={{ ...TD, textAlign: 'center' }}>{v(a.sex)}</td>
            <td style={TD}>{fmtFechaNac(a.date_of_birth)}</td>
            <td style={{ ...TD, textAlign: 'center' }}>{calcEdad(a.date_of_birth) ?? '—'}</td>
            <td style={TD}>{v(a.curp)}</td>
            <td style={TD}>{v(a.cp)}</td>
            <td style={TD}>{v(a.colonia)}</td>
            <td style={TD}>{v(a.phone)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Tabla de Atención Operativa (Bitácora) */
function AtencionTable({ activity }: { activity: Act }) {
  const actividadTexto = [
    activity.atencion_actividad,
    (activity.atencion_entregado_a || activity.atencion_entregado_rol)
      ? `El apoyo se entregó a ${activity.atencion_entregado_a ?? '—'}${
          activity.atencion_entregado_rol ? `, ${activity.atencion_entregado_rol}` : ''
        }.`
      : null,
  ].filter(Boolean).join('\n');

  return (
    <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '9pt' }}>
      <tbody>
        <tr>
          <td style={TD_LABEL}>Actividad</td>
          <td style={{ ...TD_VALUE, whiteSpace: 'pre-line' }}>{actividadTexto || '—'}</td>
          <td style={TD_LABEL_R}>Fecha{activity.atencion_fecha ? '' : ' y hora'}</td>
          <td style={TD_VALUE_R}>{fmtFecha(activity.atencion_fecha)}</td>
        </tr>
      </tbody>
    </table>
  );
}

// =============================================================================
// Página principal
// =============================================================================

interface PageProps {
  params: Promise<{ locale: string; id: string }>;
}

// Estilo base de cada hoja (simula hoja carta en pantalla)
const PAGE_STYLE: React.CSSProperties = {
  fontFamily: 'Arial, Helvetica, sans-serif',
  fontSize: '10pt',
  color: '#000',
  background: '#fff',
  width: '816px',          // 8.5 pulgadas @ 96 dpi
  minHeight: '1056px',     // 11 pulgadas @ 96 dpi
  padding: '96px',         // 1 pulgada de margen
  boxSizing: 'border-box' as const,
  margin: '0 auto 32px',
  boxShadow: '0 2px 10px rgba(0,0,0,0.15)',
};

export default async function ReportePage({ params }: PageProps) {
  await requireAdminAccess();
  const { locale, id } = await params;

  const { activity, athletes } = await getActivityForReport(id);
  if (!activity) notFound();

  const editHref  = `/${locale}/admin/bitacora/${id}/editar`;
  const eventName = activity.title?.toUpperCase() ?? '';
  const periodo   = semanaPeriodo(activity.event_date);
  const fechaEvento = fmtFecha(activity.event_date);

  return (
    <>
      {/* ── CSS de impresión ────────────────────────────────────────────── */}
      <style>{`
        @media print {
          @page {
            size: letter;
            margin: 1in;
          }

          /* Ocultar toda la UI del app */
          nav, header, aside,
          .no-print,
          [data-sidebar], [data-nav],
          #__next > *:not(#report-root) { display: none !important; }

          body  { background: white !important; margin: 0; }
          #report-root { padding: 0 !important; background: white !important; }

          /* Cada hoja = una página */
          .report-page {
            width: auto !important;
            min-height: auto !important;
            padding: 0 !important;
            margin: 0 !important;
            box-shadow: none !important;
            page-break-after: always;
          }
          .report-page:last-child { page-break-after: avoid; }

          /* Impresión selectiva */
          body[data-print-doc="1"] .report-group[data-doc="2"],
          body[data-print-doc="1"] .report-group[data-doc="3"],
          body[data-print-doc="2"] .report-group[data-doc="1"],
          body[data-print-doc="2"] .report-group[data-doc="3"],
          body[data-print-doc="3"] .report-group[data-doc="1"],
          body[data-print-doc="3"] .report-group[data-doc="2"] {
            display: none !important;
          }

          img { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          td, th { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }

        /* Vista pantalla */
        #report-root {
          background: #e5e7eb;
          min-height: 100vh;
          padding: 24px 16px;
        }
        .report-page {
          border-radius: 2px;
        }
      `}</style>

      {/* ── Barra de controles ─────────────────────────────────────────── */}
      <PrintControls backHref={editHref} activityTitle={activity.title} />

      {/* ── Contenedor de reportes ─────────────────────────────────────── */}
      <div id="report-root">

        {/* ═══════════════════════════════════════════════════════════════
            DOCUMENTO 1 — BASE DE DATOS DE BENEFICIARIOS
        ═══════════════════════════════════════════════════════════════ */}
        <div className="report-group" data-doc="1">
          <div className="report-page" style={PAGE_STYLE}>
            <PageHeader />

            <DocTitle titulo="Base de Datos de Beneficiarios" eventName={eventName} fecha={fechaEvento} />

            <SectionLabel>Requerimiento de la Dirección General de Desarrollo Social</SectionLabel>
            <MetaTable activity={activity} athletes={athletes} showBeneficiarios={false} />

            <SectionLabel>Base de datos de Beneficiarios</SectionLabel>
            <BeneficiariosDemoTable athletes={athletes} />

            <p style={{ fontSize: '9pt', marginTop: '12pt' }}>
              El archivo con la base de datos se entrega en el USB que acompaña al reporte mensual de avance.
            </p>
            <Firma />
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            DOCUMENTO 2 — BITÁCORA OPERATIVA
        ═══════════════════════════════════════════════════════════════ */}
        <div className="report-group" data-doc="2">
          <div className="report-page" style={PAGE_STYLE}>
            <PageHeader />

            <DocTitle titulo="Bitácora Operativa" eventName={eventName} fecha={fechaEvento} />

            <SectionLabel>Requerimiento de la Dirección General de Desarrollo Social</SectionLabel>
            <MetaTable activity={activity} athletes={athletes} showBeneficiarios />

            <SectionLabel>Atención por parte del Proveedor</SectionLabel>
            <AtencionTable activity={activity} />

            <Firma />
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            DOCUMENTO 3 — FICHA TÉCNICA (portada + contenido)
        ═══════════════════════════════════════════════════════════════ */}
        <div className="report-group" data-doc="3">

          {/* Página 1: Portada */}
          <div className="report-page" style={PAGE_STYLE}>
            <PageHeader />
            {/* Bloque central de la portada — tal cual el PDF */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              paddingTop: '80pt',
              gap: '6pt',
              fontSize: '11pt',
            }}>
              <p style={{ margin: 0 }}>12.4 Ficha Técnica de Actividad</p>
              <p style={{ margin: 0 }}>{P.servicio}</p>
              <p style={{ margin: 0, fontWeight: 'bold' }}>{P.contrato}</p>
              <p style={{ margin: 0, fontWeight: 'bold' }}>{P.alcaldia}</p>
              <p style={{ margin: 0, fontWeight: 'bold', fontSize: '12pt', marginTop: '4pt' }}>
                Periodo reportado: {periodo}
              </p>
              <p style={{ margin: '40pt 0 0', fontSize: '11pt' }}>
                Ciudad de México, {hoy()}
              </p>
            </div>
          </div>

          {/* Página 2: Contenido */}
          <div className="report-page" style={PAGE_STYLE}>
            <PageHeader />

            <DocTitle titulo="Ficha Técnica" eventName={eventName} fecha={fechaEvento} />

            {/* Datos del proveedor — 2 columnas sin tabla bordeada */}
            <SectionLabel>Datos del proveedor</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 24pt', fontSize: '9pt', marginBottom: '10pt' }}>
              <div>
                <p style={{ margin: '0 0 3pt' }}>{P.razon_social}</p>
                <p style={{ margin: '0 0 3pt' }}>RFC: {P.rfc}</p>
                <p style={{ margin: '0 0 3pt' }}>Domicilio: {P.domicilio_1}</p>
                <p style={{ margin: 0 }}>{P.domicilio_2}</p>
              </div>
              <div>
                <p style={{ fontWeight: 'bold', margin: '0 0 3pt' }}>Contrato:</p>
                <p style={{ margin: '0 0 3pt' }}>{P.contrato}</p>
                <p style={{ margin: 0 }}>{P.servicio}</p>
              </div>
            </div>

            <MetaTable activity={activity} athletes={athletes} showBeneficiarios />

            <p style={{ fontSize: '9pt', marginTop: '12pt' }}>
              Esta ficha se elaboró conforme a los requerimientos específicos de la Dirección General de
              Desarrollo Social.
            </p>
            <Firma />
          </div>
        </div>

      </div>
    </>
  );
}
