/**
 * AttachmentsLoader — Client Component
 *
 * Renderiza un panel que solicita adjuntos, permisos y URLs firmadas solo
 * cuando el usuario lo expande.
 *
 * Uso:
 *   <AttachmentsLoader
 *     athleteId={athlete.id}
 *     module="medical"
 *     relatedRecordId={medicalCase.id}
 *   />
 */
'use client';

import type { AttachmentModule } from '@/lib/types/attachments';
import AttachmentsPanel from './attachments-panel';

type Props = {
  athleteId: string;
  module: AttachmentModule;
  sectionName?: string;
  relatedRecordId?: string;
  title?: string;
  defaultCollapsed?: boolean;
};

export default function AttachmentsLoader({
  athleteId,
  module,
  sectionName,
  relatedRecordId,
  title,
  defaultCollapsed = false,
}: Props) {

  return (
    <AttachmentsPanel
      athleteId={athleteId}
      module={module}
      sectionName={sectionName}
      relatedRecordId={relatedRecordId}
      title={title}
      defaultCollapsed={defaultCollapsed}
    />
  );
}
