/**
 * AttachmentsLoader — Server Component
 *
 * Carga los adjuntos del atleta para un módulo/sección/registro concreto,
 * genera las URLs firmadas y resuelve los permisos del usuario actual;
 * luego renderiza el AttachmentsPanel (Client Component).
 *
 * Uso:
 *   <AttachmentsLoader
 *     athleteId={athlete.id}
 *     module="medical"
 *     relatedRecordId={medicalCase.id}
 *   />
 */

import { hasPermission } from '@/lib/rbac/server';
import {
  listAttachments,
  getAttachmentSignedUrls,
} from '@/lib/attachments/actions';
import type {
  AttachmentModule,
  ListAttachmentsParams,
} from '@/lib/types/attachments';
import AttachmentsPanel from './attachments-panel';

type Props = {
  athleteId: string;
  module: AttachmentModule;
  sectionName?: string;
  relatedRecordId?: string;
  title?: string;
  defaultCollapsed?: boolean;
};

export default async function AttachmentsLoader({
  athleteId,
  module,
  sectionName,
  relatedRecordId,
  title,
  defaultCollapsed = false,
}: Props) {
  const listParams: ListAttachmentsParams = {
    athleteId,
    module,
    sectionName,
    relatedRecordId,
  };

  const [attachments, canEdit, canDelete] = await Promise.all([
    listAttachments(listParams),
    hasPermission('edit_athletes'),
    hasPermission('delete_athletes'),
  ]);

  const signedUrlMap = await getAttachmentSignedUrls(attachments);
  const signedUrls = Object.fromEntries(signedUrlMap.entries());

  return (
    <AttachmentsPanel
      athleteId={athleteId}
      module={module}
      sectionName={sectionName}
      relatedRecordId={relatedRecordId}
      initialAttachments={attachments}
      signedUrls={signedUrls}
      canEdit={canEdit}
      canDelete={canDelete}
      title={title}
      defaultCollapsed={defaultCollapsed}
    />
  );
}
