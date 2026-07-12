'use client';

import Link from 'next/link';
import { useState } from 'react';
import { sendEmailCampaign, pauseEmailCampaign, deleteEmailCampaign } from './actions';

type Campaign = {
  id:             string;
  name:           string;
  status:         string;
  audience_type:  string;
  selection_mode: string;
  scheduled_at:   string | null;
  sent_at:        string | null;
  created_at:     string;
};

const STATUS_COLORS: Record<string, string> = {
  draft:     'bg-gray-100 text-gray-600',
  scheduled: 'bg-blue-100 text-blue-700',
  sending:   'bg-yellow-100 text-yellow-700',
  sent:      'bg-green-100 text-green-700',
  paused:    'bg-orange-100 text-orange-700',
  failed:    'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-500',
};

const STATUS_LABELS: Record<string, string> = {
  draft:     'Borrador',
  scheduled: 'Programado',
  sending:   'Enviando',
  sent:      'Enviado',
  paused:    'Pausado',
  failed:    'Fallido',
  cancelled: 'Cancelado',
};

const AUDIENCE_LABELS: Record<string, string> = {
  athlete:    'Atletas',
  staff:      'Staff',
  mixed:      'Mixto',
  individual: 'Individual',
  collective: 'Colectivo',
};

export default function EmailCampaignRow({ campaign }: { campaign: Campaign }) {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  async function handle(action: () => Promise<{ error: string | null }>) {
    setLoading(true);
    setError(null);
    const res = await action();
    if (res.error) setError(res.error);
    setLoading(false);
  }

  return (
    <>
      <tr className="hover:bg-gray-50">
        <td className="px-4 py-3 font-medium text-gray-800">
          <Link
            href={`/admin/notificaciones/email/${campaign.id}`}
            className="hover:text-rose-700 hover:underline"
          >
            {campaign.name}
          </Link>
        </td>
        <td className="px-4 py-3">
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[campaign.status] ?? 'bg-gray-100 text-gray-600'}`}>
            {STATUS_LABELS[campaign.status] ?? campaign.status}
          </span>
        </td>
        <td className="px-4 py-3 text-gray-600">
          {AUDIENCE_LABELS[campaign.audience_type] ?? campaign.audience_type}
          {' · '}
          {AUDIENCE_LABELS[campaign.selection_mode] ?? campaign.selection_mode}
        </td>
        <td className="px-4 py-3 text-gray-500 text-xs">
          {campaign.scheduled_at
            ? new Date(campaign.scheduled_at).toLocaleString('es-MX')
            : '—'}
        </td>
        <td className="px-4 py-3 text-gray-500 text-xs">
          {campaign.sent_at
            ? new Date(campaign.sent_at).toLocaleString('es-MX')
            : '—'}
        </td>
        <td className="px-4 py-3 text-right">
          <div className="flex items-center justify-end gap-2">
            {(campaign.status === 'draft' || campaign.status === 'paused') && (
              <button
                onClick={() => handle(() => sendEmailCampaign(campaign.id))}
                disabled={loading}
                className="text-xs text-green-700 hover:underline disabled:opacity-50"
              >
                Enviar
              </button>
            )}
            {campaign.status === 'sending' && (
              <button
                onClick={() => handle(() => pauseEmailCampaign(campaign.id))}
                disabled={loading}
                className="text-xs text-orange-600 hover:underline disabled:opacity-50"
              >
                Pausar
              </button>
            )}
            <Link
              href={`/admin/notificaciones/email/${campaign.id}/editar`}
              className="text-xs text-blue-600 hover:underline"
            >
              Editar
            </Link>
            <button
              onClick={() =>
                handle(() => deleteEmailCampaign(campaign.id))
              }
              disabled={loading}
              className="text-xs text-red-500 hover:underline disabled:opacity-50"
            >
              Eliminar
            </button>
          </div>
        </td>
      </tr>
      {error && (
        <tr>
          <td colSpan={6} className="px-4 py-2 text-xs text-red-600 bg-red-50">
            {error}
          </td>
        </tr>
      )}
    </>
  );
}
