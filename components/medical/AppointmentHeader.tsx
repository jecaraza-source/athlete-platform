// Server component — no 'use client' needed

type Athlete = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  profile_id: string | null;
} | null;

type Props = {
  eventId: string;
  title: string;
  athlete: Athlete;
  startAt: string;
  endAt: string;
  status: string;
  eventType: string;
};

// Generate a short display folio from event ID and date
function buildFolio(eventId: string, startAt: string): string {
  const d   = new Date(startAt);
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  return `APT-${ymd}-${eventId.slice(0, 6).toUpperCase()}`;
}

function formatDate(startAt: string): string {
  return new Date(startAt).toLocaleDateString('es-MX', {
    weekday: 'long',
    year:    'numeric',
    month:   'long',
    day:     'numeric',
  });
}

function formatTime(startAt: string): string {
  return new Date(startAt).toLocaleTimeString('es-MX', {
    hour:   '2-digit',
    minute: '2-digit',
  });
}

function durationMinutes(startAt: string, endAt: string): number {
  return Math.round((new Date(endAt).getTime() - new Date(startAt).getTime()) / 60000);
}

const STATUS_PILL: Record<string, string> = {
  scheduled:   'bg-blue-100 text-blue-700',
  show:        'bg-emerald-100 text-emerald-700',
  no_show:     'bg-red-100 text-red-700',
  rescheduled: 'bg-amber-100 text-amber-700',
  cancelled:   'bg-gray-100 text-gray-600',
};

const STATUS_LABEL: Record<string, string> = {
  scheduled:   'Programada',
  show:        'Atendida',
  no_show:     'No asistió',
  rescheduled: 'Reagendada',
  cancelled:   'Cancelada',
};

const SERVICE_LABEL: Record<string, string> = {
  medical:     'Consulta Médica',
  nutrition:   'Nutrición',
  physio:      'Fisioterapia',
  psychology:  'Psicología',
  evaluation:  'Evaluación',
  other:       'Otro',
};

export default function AppointmentHeader({
  eventId,
  title,
  athlete,
  startAt,
  endAt,
  status,
}: Props) {
  const folio    = buildFolio(eventId, startAt);
  const dateStr  = formatDate(startAt);
  const timeStr  = formatTime(startAt);
  const duration = durationMinutes(startAt, endAt);
  const initials = athlete
    ? `${athlete.first_name[0] ?? '?'}${athlete.last_name[0] ?? ''}`.toUpperCase()
    : '?';
  const serviceLabel = SERVICE_LABEL[title.toLowerCase()] ?? title;

  return (
    <div className="mt-4 rounded-xl border border-gray-200 bg-white shadow-sm p-5">
      <div className="flex items-start gap-4">
        {/* Avatar */}
        <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
          <span className="text-indigo-700 font-bold text-lg">{initials}</span>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h1 className="text-xl font-bold text-gray-900 truncate">
              {athlete ? `${athlete.first_name} ${athlete.last_name}` : 'Atleta desconocido'}
            </h1>
            <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${STATUS_PILL[status] ?? 'bg-gray-100 text-gray-600'}`}>
              {STATUS_LABEL[status] ?? status}
            </span>
          </div>

          <p className="text-sm text-gray-600 font-medium mb-3">{serviceLabel}</p>

          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
            <div className="flex items-center gap-2 text-gray-700">
              <span className="text-base">📅</span>
              <span className="capitalize">{dateStr}</span>
            </div>
            <div className="flex items-center gap-2 text-gray-700">
              <span className="text-base">🕐</span>
              <span>{timeStr}</span>
            </div>
            {duration > 0 && (
              <div className="flex items-center gap-2 text-gray-500">
                <span className="text-base">⏱</span>
                <span>Duración estimada: {duration} min</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-gray-500">
              <span className="text-base">🔢</span>
              <span className="font-mono text-xs">{folio}</span>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}
