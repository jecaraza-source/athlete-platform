'use client';

import { useState } from 'react';
import { sendManualTicketEmail } from '../../notificaciones/tickets/actions';
import { sendTicketPushNotification } from '../actions';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Delivery = { status: string; recorded_at: string };

export type EmailJob = {
  id:               string;
  event_key:        string;
  email_type:       string;
  trigger_type:     string;
  recipient_email:  string;
  subject:          string;
  status:           string;
  scheduled_at:     string;
  processed_at:     string | null;
  created_at:       string;
  triggered_by_profile: { first_name: string; last_name: string } | null;
  recipient_profile:    { first_name: string; last_name: string } | null;
  deliveries:           Delivery[];
};

type Recipient = {
  profileId:  string | null;
  email:      string;
  label:      string;         // display name
  role:       'creator' | 'assignee';
};

type Props = {
  ticketId:   string;
  initialHistory: EmailJob[];
  recipients: Recipient[];    // pre-built from server: creator + all assignees
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EMAIL_TYPES = [
  { value: 'reminder',      eventKey: 'ticket_pending_response', label: 'Recordatorio' },
  { value: 'follow_up',     eventKey: 'ticket_follow_up',        label: 'Seguimiento' },
  { value: 'status_update', eventKey: 'ticket_status_updated',   label: 'Actualización de estado' },
  { value: 'overdue',       eventKey: 'ticket_overdue',          label: 'Vencido' },
  { value: 'resolution',    eventKey: 'ticket_resolved',         label: 'Resolución' },
] as const;

const EMAIL_TYPE_LABELS: Record<string, string> = {
  reminder:      'Recordatorio',
  follow_up:     'Seguimiento',
  status_update: 'Actualización',
  assignment:    'Asignación',
  overdue:       'Vencido',
  resolution:    'Resolución',
  creation:      'Creación',
  closure:       'Cierre',
};

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  sent:       { bg: 'bg-green-100',  text: 'text-green-700',  label: 'Enviado' },
  delivered:  { bg: 'bg-green-100',  text: 'text-green-700',  label: 'Entregado' },
  failed:     { bg: 'bg-red-100',    text: 'text-red-600',    label: 'Fallido' },
  pending:    { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Pendiente' },
  processing: { bg: 'bg-blue-100',   text: 'text-blue-600',   label: 'Procesando' },
  retrying:   { bg: 'bg-orange-100', text: 'text-orange-600', label: 'Reintentando' },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type Tab = 'email' | 'push';

export default function TicketEmailPanel({ ticketId, initialHistory, recipients }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('email');

  // ── Email state ─────────────────────────────────────────────────────
  const [history,   setHistory]  = useState<EmailJob[]>(initialHistory);
  const [showForm,  setShowForm] = useState(false);
  const [loading,   setLoading]  = useState(false);
  const [error,     setError]    = useState<string | null>(null);
  const [emailType, setEmailType] = useState(EMAIL_TYPES[0].value as string);
  const [recipientEmail,     setRecipientEmail]     = useState(recipients[0]?.email ?? '');
  const [recipientProfileId, setRecipientProfileId] = useState<string | null>(recipients[0]?.profileId ?? null);
  const [useCustomEmail, setUseCustomEmail] = useState(recipients.length === 0);
  const [customEmail,    setCustomEmail]    = useState('');

  // ── Push state ─────────────────────────────────────────────────────
  const pushRecipients = recipients.filter((r) => r.profileId);
  const [pushProfileId,   setPushProfileId]   = useState<string>(pushRecipients[0]?.profileId ?? '');
  const [pushMessage,     setPushMessage]     = useState('');
  const [pushNoteType,    setPushNoteType]    = useState('update');
  const [pushLoading,     setPushLoading]     = useState(false);
  const [pushError,       setPushError]       = useState<string | null>(null);
  const [pushSuccess,     setPushSuccess]     = useState<string | null>(null);

  function handleRecipientChange(value: string) {
    if (value === '__custom__') {
      setUseCustomEmail(true);
      setRecipientEmail('');
      setRecipientProfileId(null);
    } else {
      setUseCustomEmail(false);
      const r = recipients.find((r) => r.email === value);
      setRecipientEmail(value);
      setRecipientProfileId(r?.profileId ?? null);
    }
  }

  async function handleSend(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const finalEmail     = useCustomEmail ? customEmail : recipientEmail;
    const finalProfileId = useCustomEmail ? null : recipientProfileId;
    const selectedType   = EMAIL_TYPES.find((t) => t.value === emailType);

    const fd = new FormData();
    fd.set('ticket_id',            ticketId);
    fd.set('event_key',            selectedType?.eventKey ?? 'ticket_follow_up');
    fd.set('email_type',           emailType);
    fd.set('recipient_email',      finalEmail);
    if (finalProfileId) fd.set('recipient_profile_id', finalProfileId);

    const res = await sendManualTicketEmail(fd);
    setLoading(false);

    if (res.error) {
      setError(res.error);
    } else {
      // Optimistically prepend to history
      const optimistic: EmailJob = {
        id:               `optimistic-${Date.now()}`,
        event_key:        selectedType?.eventKey ?? 'ticket_follow_up',
        email_type:       emailType,
        trigger_type:     'manual',
        recipient_email:  finalEmail,
        subject:          `${EMAIL_TYPE_LABELS[emailType] ?? emailType} — (recargando…)`,
        status:           'sent',
        scheduled_at:     new Date().toISOString(),
        processed_at:     new Date().toISOString(),
        created_at:       new Date().toISOString(),
        triggered_by_profile: null,
        recipient_profile:    null,
        deliveries:           [{ status: 'sent', recorded_at: new Date().toISOString() }],
      };
      setHistory((prev) => [optimistic, ...prev]);
      setShowForm(false);
    }
  }

  async function handlePushSend(e: React.FormEvent) {
    e.preventDefault();
    if (!pushProfileId) return;
    setPushLoading(true);
    setPushError(null);
    setPushSuccess(null);
    const result = await sendTicketPushNotification(ticketId, pushProfileId, pushMessage, pushNoteType);
    setPushLoading(false);
    if (result.error) {
      setPushError(result.error);
    } else {
      setPushSuccess(`✅ Push enviado a ${result.deviceCount ?? 1} dispositivo(s).`);
      setPushMessage('');
    }
  }

  return (
    <section>
      {/* ── Tabs ────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-1 rounded-lg border border-gray-200 p-0.5 bg-gray-50">
          <button
            type="button"
            onClick={() => { setActiveTab('email'); setShowForm(false); }}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'email'
                ? 'bg-white shadow-sm text-gray-900'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            ✉️ Email
            {history.length > 0 && (
              <span className="ml-1.5 text-xs text-gray-400">({history.length})</span>
            )}
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('push'); setShowForm(false); }}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'push'
                ? 'bg-white shadow-sm text-gray-900'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            📲 Push
          </button>
        </div>

        {activeTab === 'email' && (
          <button
            type="button"
            onClick={() => { setShowForm(!showForm); setError(null); }}
            className="rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700"
          >
            {showForm ? 'Cancelar' : '+ Enviar email'}
          </button>
        )}
      </div>

      {/* ── Push tab ────────────────────────────────────────────── */}
      {activeTab === 'push' && (
        <form
          onSubmit={handlePushSend}
          className="rounded-lg border border-indigo-200 bg-indigo-50 p-4 space-y-4"
        >
          <p className="text-xs text-indigo-600">
            Envía una notificación push directamente al móvil del destinatario.
            Solo funciona si tienen la app instalada y notificaciones activas.
          </p>

          <div className="grid grid-cols-2 gap-3">
            {/* Destinatario */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Destinatario</label>
              {pushRecipients.length > 0 ? (
                <select
                  value={pushProfileId}
                  onChange={(e) => setPushProfileId(e.target.value)}
                  className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                  required
                >
                  {pushRecipients.map((r) => (
                    <option key={r.profileId!} value={r.profileId!}>
                      {r.label} ({r.role === 'creator' ? 'solicitante' : 'asignado'})
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-xs text-gray-400 italic py-1.5">
                  No hay destinatarios con perfil registrado.
                </p>
              )}
            </div>

            {/* Tipo */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Tipo</label>
              <select
                value={pushNoteType}
                onChange={(e) => setPushNoteType(e.target.value)}
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
              >
                <option value="update">Actualización</option>
                <option value="reminder">Recordatorio</option>
                <option value="urgent">Urgente</option>
                <option value="resolved">Resolución</option>
              </select>
            </div>
          </div>

          {/* Mensaje */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Mensaje <span className="text-gray-400">(él verá esto en su móvil)</span>
            </label>
            <textarea
              value={pushMessage}
              onChange={(e) => setPushMessage(e.target.value)}
              rows={3}
              required
              maxLength={200}
              placeholder="Escribe el mensaje que verá el destinatario en la notificación…"
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm resize-none"
            />
            <p className="text-xs text-gray-400 mt-0.5 text-right">{pushMessage.length}/200</p>
          </div>

          {pushError && <p className="text-sm text-red-600 bg-red-50 rounded p-2">{pushError}</p>}
          {pushSuccess && <p className="text-sm text-green-700 bg-green-50 rounded p-2">{pushSuccess}</p>}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={pushLoading || !pushProfileId || !pushMessage.trim()}
              className="rounded-md bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {pushLoading ? 'Enviando…' : '📲 Enviar push'}
            </button>
          </div>
        </form>
      )}

      {/* ── Send form ───────────────────────────────────────────── */}
      {showForm && (
        <form
          onSubmit={handleSend}
          className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-4 mb-6"
        >
          {/* Type */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Tipo de email</label>
              <select
                value={emailType}
                onChange={(e) => setEmailType(e.target.value)}
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
              >
                {EMAIL_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            {/* Recipient */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Destinatario</label>
              {recipients.length > 0 ? (
                <select
                  onChange={(e) => handleRecipientChange(e.target.value)}
                  className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                >
                  {recipients.map((r) => (
                    <option key={r.email} value={r.email}>
                      {r.label} ({r.role === 'creator' ? 'solicitante' : 'asignado'})
                    </option>
                  ))}
                  <option value="__custom__">Otro…</option>
                </select>
              ) : (
                <input
                  type="email" required
                  value={customEmail}
                  onChange={(e) => setCustomEmail(e.target.value)}
                  className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                  placeholder="correo@ejemplo.com"
                />
              )}
            </div>
          </div>

          {useCustomEmail && recipients.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Email personalizado</label>
              <input
                type="email" required
                value={customEmail}
                onChange={(e) => setCustomEmail(e.target.value)}
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                placeholder="correo@ejemplo.com"
              />
            </div>
          )}

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded p-2">{error}</p>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={loading}
              className="rounded-md bg-amber-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
            >
              {loading ? 'Enviando…' : 'Enviar ahora'}
            </button>
          </div>
        </form>
      )}

      {/* ── Communication history ───────────────────────────────── */}
      {history.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-200 p-8 text-center text-gray-400 text-sm">
          Sin correos enviados para este ticket.
        </div>
      ) : (
        <ul className="space-y-3">
          {history.map((job) => {
            const st      = STATUS_STYLES[job.status];
            const isAuto  = job.trigger_type !== 'manual';
            const typeLabel = EMAIL_TYPE_LABELS[job.email_type] ?? job.email_type;
            // Best delivery status = latest delivery event
            const latestDelivery = job.deliveries?.sort(
              (a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime()
            )[0];

            return (
              <li key={job.id} className="rounded-lg border border-gray-100 p-4 space-y-2">
                {/* Row 1: subject + status */}
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-medium text-gray-800 leading-snug flex-1 min-w-0 truncate">
                    {job.subject}
                  </p>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {st && (
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${st.bg} ${st.text}`}>
                        {st.label}
                      </span>
                    )}
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                      isAuto ? 'bg-gray-100 text-gray-500' : 'bg-blue-50 text-blue-600'
                    }`}>
                      {isAuto ? 'Auto' : 'Manual'}
                    </span>
                  </div>
                </div>

                {/* Row 2: meta */}
                <div className="grid grid-cols-2 gap-x-4 text-xs text-gray-500">
                  <div>
                    <span className="font-medium text-gray-400">Tipo</span>{' '}
                    {typeLabel}
                  </div>
                  <div className="truncate">
                    <span className="font-medium text-gray-400">Para</span>{' '}
                    {job.recipient_profile
                      ? `${job.recipient_profile.first_name} ${job.recipient_profile.last_name}`
                      : job.recipient_email}
                  </div>
                  <div>
                    <span className="font-medium text-gray-400">Por</span>{' '}
                    {job.triggered_by_profile
                      ? `${job.triggered_by_profile.first_name} ${job.triggered_by_profile.last_name}`
                      : 'Sistema'}
                  </div>
                  <div>
                    <span className="font-medium text-gray-400">Fecha</span>{' '}
                    {new Date(job.created_at).toLocaleString('es-MX', {
                      month: 'short', day: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </div>
                </div>

                {/* Row 3: latest delivery event */}
                {latestDelivery && latestDelivery.status !== job.status && (
                  <p className="text-xs text-gray-400">
                    Último evento:{' '}
                    <span className="font-medium">{STATUS_STYLES[latestDelivery.status]?.label ?? latestDelivery.status}</span>
                    {' · '}
                    {new Date(latestDelivery.recorded_at).toLocaleTimeString('es-MX', {
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
