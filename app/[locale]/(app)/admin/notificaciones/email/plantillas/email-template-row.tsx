'use client';

import Link from 'next/link';

type Template = {
  id:         string;
  name:       string;
  subject:    string;
  status:     string;
  version:    number;
  updated_at: string;
};

const STATUS_COLORS: Record<string, string> = {
  draft:    'bg-gray-100 text-gray-600',
  active:   'bg-green-100 text-green-700',
  archived: 'bg-orange-100 text-orange-600',
};
const STATUS_LABELS: Record<string, string> = {
  draft: 'Borrador', active: 'Activa', archived: 'Archivada',
};

export default function EmailTemplateRow({ template }: { template: Template }) {
  return (
    <tr className="hover:bg-gray-50">
      <td className="px-4 py-3 font-medium text-gray-800">{template.name}</td>
      <td className="px-4 py-3 text-gray-500 text-xs truncate max-w-xs">{template.subject}</td>
      <td className="px-4 py-3">
        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[template.status] ?? 'bg-gray-100'}`}>
          {STATUS_LABELS[template.status] ?? template.status}
        </span>
      </td>
      <td className="px-4 py-3 text-gray-500 text-xs">v{template.version}</td>
      <td className="px-4 py-3 text-gray-400 text-xs">
        {new Date(template.updated_at).toLocaleDateString('es-MX')}
      </td>
      <td className="px-4 py-3 text-right">
        <Link
          href={`/admin/notificaciones/email/plantillas/${template.id}`}
          className="text-xs text-rose-600 hover:underline"
        >
          Editar
        </Link>
      </td>
    </tr>
  );
}
