import { notFound }             from 'next/navigation';
import Link                      from 'next/link';
import { requireAdminAccess }    from '@/lib/rbac/server';
import { getActivityForReport }  from '@/lib/bitacora/queries';
import { PrintControls }         from '@/components/bitacora/PrintControls';
import type { ReportAthlete }    from '@/lib/types/bitacora';

// =============================================================================
// Constantes del proveedor (Ficha Técnica)
// =============================================================================
const PROVEEDOR = {
  razon_social:  'Comercializadora Arystan, S.A. de C.V.',
  contrato:      'CAAPS/26-04-005',
  rfc:           'CAR220708NL9',
  servicio:      'Servicio Integral Técnico Especializado para el Fortalecimiento al Deporte',
  domicilio:     'Mariano Escobedo 476, Piso 12, Col. Anzures, CP 11590, Alc. Miguel Hidalgo, Ciudad de México',
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

function formatFecha(dateStr: string | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
}

function formatFechaNac(dateStr: string | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function semanaPeriodo(dateStr: string | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T12:00:00');
  const dow = d.getDay(); // 0=Dom
  const lunes = new Date(d);
  lunes.setDate(d.getDate() - ((dow + 6) % 7));
  const sabado = new Date(lunes);
  sabado.setDate(lunes.getDate() + 5);
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long' };
  return `Semana del ${lunes.toLocaleDateString('es-MX', opts)} al ${sabado.toLocaleDateString('es-MX', opts)}`;
}

function hoy(): string {
  return new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
}

// =============================================================================
// Sub-componentes de documento
// =============================================================================

/** Encabezado compartido por los 3 documentos */
function DocHeader({ titulo, eventName }: { titulo: string; eventName: string }) {
  return (
    <div style={{ textAlign: 'center', marginBottom: '16px' }}>
      <p style={{ fontSize: '11pt', fontWeight: 'bold', marginBottom: '4px' }}>{titulo}</p>
      <p style={{ fontSize: '12pt', fontWeight: 'bold', textTransform: 'uppercase' }}>{eventName}</p>
      <p style={{ fontSize: '9pt', marginTop: '8px' }}>Fecha</p>
      <p style={{ fontSize: '10pt' }}>{hoy()}</p>
    </div>
  );
}

/** Bloque de metadatos de la actividad */
function ActividadMeta({ activity }: { activity: NonNullable<Awaited<ReturnType<typeof getActivityForReport>>['activity']> }) {
  const rows: [string, string | null | number][] = [
    ['Disciplina',            activity.disciplina],
    ['Especialidad',          activity.especialidad],
    ['Actividad',             activity.actividad_tipo],
    ['Sede',                  activity.sede ?? activity.location],
    ['Fecha',                 formatFecha(activity.event_date)],
    ['Horario',               activity.horario],
    ['Número de participantes', activity.numero_participantes],
    ['Requerimiento',         activity.requerimiento],
    ['Objetivo',              activity.objetivo],
    ['Personal requerido',    activity.personal_requerido ?? 'Ninguno'],
    ['Equipo requerido',      activity.equipo_requerido   ?? 'Ninguno'],
  ];

  return (
    <div style={{ marginBottom: '12px', fontSize: '9.5pt' }}>
      <p style={{ fontWeight: 'bold', marginBottom: '6px', fontSize: '9pt', textTransform: 'uppercase', color: '#555' }}>
        Requerimiento de la Dirección General de Desarrollo Social
      </p>
      {rows.filter(([, v]) => v !== null && v !== undefined && v !== '').map(([label, val]) => (
        <div key={label} style={{ display: 'flex', gap: '4px', marginBottom: '2px' }}>
          <span style={{ fontWeight: 'bold', minWidth: '180px' }}>{label}:</span>
          <span>{String(val)}</span>
        </div>
      ))}
    </div>
  );
}

/** Tabla de beneficiarios */
function TablaBeneficiarios({ athletes }: { athletes: ReportAthlete[] }) {
  const COLS = [
    { key: 'folio',    label: 'Folio',              w: '52px'  },
    { key: 'nombre',   label: 'Nombre',              w: '80px'  },
    { key: 'apellido', label: 'Apellido',             w: '96px'  },
    { key: 'disc',     label: 'Disciplina',           w: '72px'  },
    { key: 'sexo',     label: 'Sexo',                 w: '30px'  },
    { key: 'fnac',     label: 'Fecha Nac.',           w: '64px'  },
    { key: 'edad',     label: 'Edad',                 w: '28px'  },
    { key: 'curp',     label: 'CURP',                 w: '120px' },
    { key: 'cp',       label: 'CP',                   w: '36px'  },
    { key: 'colonia',  label: 'Colonia',              w: '80px'  },
    { key: 'tel',      label: 'Teléfono',             w: '80px'  },
  ];

  const tdStyle: React.CSSProperties = {
    border: '1px solid #999',
    padding: '2px 3px',
    fontSize: '7.5pt',
    verticalAlign: 'top',
    wordBreak: 'break-word',
  };
  const thStyle: React.CSSProperties = {
    ...tdStyle,
    fontWeight: 'bold',
    backgroundColor: '#e8e8e8',
    textAlign: 'center',
  };

  return (
    <div style={{ marginBottom: '12px' }}>
      <p style={{ fontWeight: 'bold', marginBottom: '6px', fontSize: '9.5pt' }}>
        Base de datos de Beneficiarios
      </p>
      <table style={{ borderCollapse: 'collapse', width: '100%', tableLayout: 'fixed' }}>
        <colgroup>
          {COLS.map((c) => <col key={c.key} style={{ width: c.w }} />)}
        </colgroup>
        <thead>
          <tr>
            {COLS.map((c) => <th key={c.key} style={thStyle}>{c.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {athletes.length === 0 ? (
            <tr>
              <td colSpan={COLS.length} style={{ ...tdStyle, textAlign: 'center', color: '#888' }}>
                Sin beneficiarios vinculados
              </td>
            </tr>
          ) : (
            athletes.map((a) => (
              <tr key={a.athlete_id}>
                <td style={tdStyle}>{a.athlete_code ?? '—'}</td>
                <td style={tdStyle}>{a.first_name}</td>
                <td style={tdStyle}>{a.last_name}</td>
                <td style={tdStyle}>{a.discipline ?? '—'}</td>
                <td style={{ ...tdStyle, textAlign: 'center' }}>{a.sex ?? '—'}</td>
                <td style={tdStyle}>{formatFechaNac(a.date_of_birth)}</td>
                <td style={{ ...tdStyle, textAlign: 'center' }}>{calcEdad(a.date_of_birth) ?? '—'}</td>
                <td style={tdStyle}>{a.curp ?? '—'}</td>
                <td style={tdStyle}>{a.cp ?? '—'}</td>
                <td style={tdStyle}>{a.colonia ?? '—'}</td>
                <td style={tdStyle}>{a.phone ?? '—'}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

/** Lista de beneficiarios (para Bitácora / Ficha) */
function ListaBeneficiarios({ athletes }: { athletes: ReportAthlete[] }) {
  return (
    <div style={{ marginBottom: '10px', fontSize: '9.5pt' }}>
      {(['Beneficiarios', 'Población objetivo'] as const).map((label) => (
        <div key={label} style={{ marginBottom: '6px' }}>
          <span style={{ fontWeight: 'bold' }}>{label}:</span>
          <div style={{ paddingLeft: '8px' }}>
            {athletes.length === 0
              ? <span style={{ color: '#888' }}>Sin beneficiarios vinculados</span>
              : athletes.map((a) => (
                  <div key={a.athlete_id}>
                    {a.athlete_code} {a.first_name} {a.last_name}
                  </div>
                ))
            }
          </div>
        </div>
      ))}
    </div>
  );
}

/** Firma común */
function Firma({ nombre, cargo }: { nombre: string; cargo: string }) {
  return (
    <div style={{ marginTop: '28px', fontSize: '9.5pt' }}>
      <p style={{ marginBottom: '2px' }}>Atentamente,</p>
      <p style={{ fontWeight: 'bold' }}>{nombre}</p>
      <p>{cargo}</p>
    </div>
  );
}

// =============================================================================
// Página principal
// =============================================================================

interface PageProps {
  params: Promise<{ locale: string; id: string }>;
}

export default async function ReportePage({ params }: PageProps) {
  await requireAdminAccess();
  const { locale, id } = await params;

  const { activity, athletes } = await getActivityForReport(id);
  if (!activity) notFound();

  const editHref = `/${locale}/admin/bitacora/${id}/editar`;
  const eventName = activity.title?.toUpperCase() ?? '';
  const periodo   = semanaPeriodo(activity.event_date);

  const docStyle: React.CSSProperties = {
    fontFamily: 'Arial, sans-serif',
    fontSize: '10pt',
    color: '#000',
    maxWidth: '720px',
    margin: '0 auto',
    padding: '24px 0',
  };

  return (
    <>
      {/* ── CSS de impresión ── */}
      {/* eslint-disable-next-line react/no-unknown-property */}
      <style>{`
        @media print {
          @page { size: A4; margin: 1.8cm 2cm; }

          /* Ocultar nav, headers, la barra de controles y Tailwind layout */
          nav, header, aside,
          .no-print,
          [data-sidebar],
          [data-nav] { display: none !important; }

          body { background: white !important; }

          /* Documentos individuales */
          .report-doc { page-break-after: always; }
          .report-doc:last-child { page-break-after: avoid; }

          /* Impresión selectiva por documento */
          body[data-print-doc="1"] .report-doc[data-doc="2"],
          body[data-print-doc="1"] .report-doc[data-doc="3"],
          body[data-print-doc="2"] .report-doc[data-doc="1"],
          body[data-print-doc="2"] .report-doc[data-doc="3"],
          body[data-print-doc="3"] .report-doc[data-doc="1"],
          body[data-print-doc="3"] .report-doc[data-doc="2"] {
            display: none !important;
          }
        }

        /* Vista previa en pantalla */
        .report-doc {
          background: white;
          box-shadow: 0 2px 8px rgba(0,0,0,0.12);
          border-radius: 4px;
          padding: 32px 40px;
          margin-bottom: 32px;
        }

        @media (max-width: 640px) {
          .report-doc { padding: 16px; }
        }
      `}</style>

      {/* ── Barra de controles ── */}
      <PrintControls backHref={editHref} activityTitle={activity.title} />

      {/* ── Contenedor de documentos ── */}
      <div style={{ background: '#f3f4f6', minHeight: '100vh', padding: '24px 16px' }}>
        <div style={{ maxWidth: '760px', margin: '0 auto' }}>

          {/* ── DOCUMENTO 1: BASE DE DATOS DE BENEFICIARIOS ── */}
          <div className="report-doc" data-doc="1" style={docStyle}>
            <DocHeader titulo="Base de Datos de Beneficiarios" eventName={eventName} />
            <ActividadMeta activity={activity} />
            <TablaBeneficiarios athletes={athletes} />
            <p style={{ fontSize: '9pt', marginBottom: '4px', color: '#444' }}>
              El archivo con la base de datos se entrega en el USB que acompaña al reporte mensual de avance.
            </p>
            <Firma nombre={PROVEEDOR.administrador} cargo={PROVEEDOR.cargo} />
          </div>

          {/* ── DOCUMENTO 2: BITÁCORA OPERATIVA ── */}
          <div className="report-doc" data-doc="2" style={docStyle}>
            <DocHeader titulo="Bitácora Operativa" eventName={eventName} />
            <ActividadMeta activity={activity} />
            <ListaBeneficiarios athletes={athletes} />

            {/* Atención por parte del Proveedor */}
            <div style={{ marginBottom: '10px', fontSize: '9.5pt' }}>
              <p style={{ fontWeight: 'bold', marginBottom: '6px' }}>
                Atención por parte del Proveedor
              </p>
              {activity.atencion_actividad && (
                <div style={{ display: 'flex', gap: '4px', marginBottom: '2px' }}>
                  <span style={{ fontWeight: 'bold', minWidth: '64px' }}>Actividad</span>
                  <span>{activity.atencion_actividad}</span>
                </div>
              )}
              {(activity.atencion_entregado_a || activity.atencion_entregado_rol) && (
                <div style={{ marginBottom: '2px' }}>
                  El apoyo se entregó a{' '}
                  <strong>{activity.atencion_entregado_a ?? '—'}</strong>
                  {activity.atencion_entregado_rol && `, ${activity.atencion_entregado_rol}`}.
                </div>
              )}
              {activity.atencion_fecha && (
                <div style={{ display: 'flex', gap: '4px', marginBottom: '2px' }}>
                  <span style={{ fontWeight: 'bold', minWidth: '64px' }}>Fecha y hora</span>
                  <span>{formatFecha(activity.atencion_fecha)}</span>
                </div>
              )}
            </div>

            <Firma nombre={PROVEEDOR.administrador} cargo={PROVEEDOR.cargo} />
          </div>

          {/* ── DOCUMENTO 3: FICHA TÉCNICA ── */}
          <div className="report-doc" data-doc="3" style={docStyle}>
            {/* Encabezado institucional */}
            <div style={{ marginBottom: '14px', fontSize: '9pt', textAlign: 'center' }}>
              <p style={{ fontWeight: 'bold' }}>12.4 Ficha Técnica de Actividad</p>
              <p>{PROVEEDOR.servicio}</p>
              <p>{PROVEEDOR.contrato}</p>
              <p style={{ fontWeight: 'bold' }}>{PROVEEDOR.alcaldia}</p>
              <p>Periodo reportado: {periodo}</p>
            </div>
            <p style={{ fontSize: '9pt', textAlign: 'right', marginBottom: '14px' }}>
              Ciudad de México, {hoy()}
            </p>

            <DocHeader titulo="Ficha Técnica" eventName={eventName} />

            {/* Datos del proveedor */}
            <div style={{ marginBottom: '12px', fontSize: '9.5pt' }}>
              <p style={{ fontWeight: 'bold', marginBottom: '6px' }}>Datos del proveedor</p>
              {[
                ['Contrato',  `${PROVEEDOR.razon_social}  |  ${PROVEEDOR.contrato}`],
                ['RFC',       PROVEEDOR.rfc],
                ['Servicio',  PROVEEDOR.servicio],
                ['Domicilio', PROVEEDOR.domicilio],
              ].map(([label, val]) => (
                <div key={label} style={{ display: 'flex', gap: '4px', marginBottom: '2px' }}>
                  <span style={{ fontWeight: 'bold', minWidth: '70px' }}>{label}:</span>
                  <span>{val}</span>
                </div>
              ))}
            </div>

            <ActividadMeta activity={activity} />
            <ListaBeneficiarios athletes={athletes} />

            <p style={{ fontSize: '9pt', marginTop: '8px', color: '#444' }}>
              Esta ficha se elaboró conforme a los requerimientos específicos de la Dirección General de Desarrollo Social.
            </p>
            <Firma nombre={PROVEEDOR.administrador} cargo={PROVEEDOR.cargo} />
          </div>

        </div>
      </div>
    </>
  );
}
