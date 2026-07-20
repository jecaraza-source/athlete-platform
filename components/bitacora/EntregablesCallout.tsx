import Link from 'next/link';
import type { ActivityAthlete } from '@/lib/types/bitacora';

// =============================================================================
// EntregablesCallout
// Server Component — tarjeta que aparece en el flujo editorial cuando la
// actividad tiene atletas vinculados. Enlaza a /reporte para imprimir los
// 3 documentos entregables (Base Datos, Bitácora, Ficha Técnica).
// =============================================================================

interface Props {
  activityId: string;
  locale:     string;
  athletes:   ActivityAthlete[];
  /** Campos de atención operativa completados */
  atencionCompleta: boolean;
}

export function EntregablesCallout({ activityId, locale, athletes, atencionCompleta }: Props) {
  const count       = athletes.length;
  const reporteHref = `/${locale}/admin/bitacora/${activityId}/reporte`;

  // Con atletas y atención completa: listo para imprimir
  const ready = count > 0 && atencionCompleta;

  if (count === 0) {
    // Sin atletas: mostrar hint menor para que vayan a vincularlos
    return (
      <div className="flex items-start gap-3 border border-amber-200 bg-amber-50 rounded-xl px-4 py-3.5 no-print">
        <div className="shrink-0 w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center text-[15px]">
          📋
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-widest text-amber-500 mb-0.5">
            Entregables Operativos
          </p>
          <p className="text-sm font-semibold text-amber-900">
            Vincula atletas beneficiarios para generar los reportes entregables.
          </p>
          <p className="text-xs text-amber-700 opacity-70 mt-0.5">
            Ve a la sección &quot;Atletas Beneficiarios&quot; en el formulario de información.
          </p>
        </div>
      </div>
    );
  }

  return (
    <Link
      href={reporteHref}
      className={`flex items-start gap-3 border rounded-xl px-4 py-3.5 transition-colors no-print group ${
        ready
          ? 'border-emerald-200 bg-emerald-50 hover:border-emerald-300 hover:bg-emerald-100'
          : 'border-blue-200 bg-blue-50 hover:border-blue-300'
      }`}
    >
      {/* Icon */}
      <div className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-[15px] font-bold ${
        ready ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600'
      }`}>
        🖨
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className={`text-[11px] font-bold uppercase tracking-widest mb-0.5 ${
          ready ? 'text-emerald-600' : 'text-blue-500'
        }`}>
          Entregables Operativos
        </p>
        <p className={`text-sm font-semibold leading-snug ${
          ready ? 'text-emerald-900' : 'text-blue-900'
        }`}>
          {ready
            ? `${count} atleta${count !== 1 ? 's' : ''} vinculado${count !== 1 ? 's' : ''} · Listo para imprimir`
            : `${count} atleta${count !== 1 ? 's' : ''} vinculado${count !== 1 ? 's' : ''} · Completa la Atención Operativa`
          }
        </p>
        <p className={`text-xs mt-0.5 opacity-70 ${
          ready ? 'text-emerald-900' : 'text-blue-900'
        }`}>
          {ready
            ? 'Haz clic para previsualizar e imprimir Base de Datos, Bitácora y Ficha Técnica →'
            : 'Rellena "Descripción", "Entregado a" y "Fecha" en la sección Atención Operativa.'
          }
        </p>
      </div>

      {/* Checklist */}
      <div className="shrink-0 flex flex-col gap-1 text-right">
        {[
          { ok: count > 0,          label: `${count} atletas` },
          { ok: atencionCompleta,   label: 'Atención OK'      },
        ].map((item) => (
          <span
            key={item.label}
            className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
              item.ok
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-gray-100 text-gray-400'
            }`}
          >
            {item.ok ? '✓' : '○'} {item.label}
          </span>
        ))}
      </div>
    </Link>
  );
}
