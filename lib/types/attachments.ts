// =============================================================================
// lib/types/attachments.ts
// Tipos compartidos para el módulo de Documentos Anexos del Expediente
// =============================================================================

// ---------------------------------------------------------------------------
// Módulos soportados
// ---------------------------------------------------------------------------

export type AttachmentModule =
  | 'diagnostic'   // Diagnóstico inicial (sección específica)
  | 'medical'      // Seguimiento médico
  | 'nutrition'    // Seguimiento nutricional
  | 'physio'       // Seguimiento de fisioterapia
  | 'psychology'   // Seguimiento psicológico
  | 'training';    // Seguimiento del entrenador

export const MODULE_LABELS: Record<AttachmentModule, string> = {
  diagnostic:  'Diagnóstico Inicial',
  medical:     'Seguimiento Médico',
  nutrition:   'Seguimiento Nutricional',
  physio:      'Seguimiento Fisioterapia',
  psychology:  'Seguimiento Psicológico',
  training:    'Seguimiento Entrenamiento',
};

export const MODULE_COLORS: Record<AttachmentModule, string> = {
  diagnostic: 'bg-emerald-100 text-emerald-700',
  medical:    'bg-red-100 text-red-700',
  nutrition:  'bg-amber-100 text-amber-700',
  physio:     'bg-blue-100 text-blue-700',
  psychology: 'bg-purple-100 text-purple-700',
  training:   'bg-orange-100 text-orange-700',
};

export const ALL_MODULES: AttachmentModule[] = [
  'diagnostic',
  'medical',
  'nutrition',
  'physio',
  'psychology',
  'training',
];

// ---------------------------------------------------------------------------
// Tipos MIME y extensiones permitidas
// ---------------------------------------------------------------------------

/** Tipos MIME aceptados por el sistema. */
export const ALLOWED_MIME_TYPES: ReadonlySet<string> = new Set([
  // PDF
  'application/pdf',
  // Imágenes
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  // Word
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  // Excel
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  // PowerPoint
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  // Texto y CSV
  'text/plain',
  'text/csv',
  'application/csv',
]);

/** String para el atributo `accept` del input file. */
export const ACCEPT_STRING =
  '.pdf,.jpg,.jpeg,.png,.webp,.heic,.heif,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv';

/** Tamaño máximo por archivo: 50 MB. */
export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

/** Número máximo de archivos por carga simultánea. */
export const MAX_FILES_PER_UPLOAD = 10;

// ---------------------------------------------------------------------------
// Tipos de preview
// ---------------------------------------------------------------------------

export type PreviewType = 'image' | 'pdf' | 'text' | 'none';

export function getPreviewType(mimeType: string): PreviewType {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType === 'application/pdf') return 'pdf';
  if (mimeType === 'text/plain' || mimeType === 'text/csv' || mimeType === 'application/csv')
    return 'text';
  return 'none';
}

// ---------------------------------------------------------------------------
// Tipo de registro de base de datos
// ---------------------------------------------------------------------------

export type AthleteAttachment = {
  id: string;
  athlete_id: string;
  module_name: AttachmentModule;
  section_name: string | null;
  related_record_id: string | null;
  file_name_original: string;
  file_name_storage: string;
  file_path: string;
  mime_type: string;
  file_extension: string;
  file_size: number;
  description: string | null;
  uploaded_by: string | null;
  uploaded_at: string;
  updated_at: string;
  deleted_by: string | null;
  deleted_at: string | null;
  is_active: boolean;
  // Join opcional con profiles
  uploader?: { first_name: string; last_name: string } | null;
};

// ---------------------------------------------------------------------------
// Parámetros para subir y listar
// ---------------------------------------------------------------------------

export type UploadAttachmentParams = {
  athleteId: string;
  module: AttachmentModule;
  sectionName?: string;
  relatedRecordId?: string;
  description?: string;
};

export type ListAttachmentsParams = {
  athleteId: string;
  module?: AttachmentModule;
  relatedRecordId?: string;
  sectionName?: string;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Formatea bytes a texto legible (KB, MB). */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Devuelve la extensión en minúsculas a partir de un nombre de archivo. */
export function getExtension(fileName: string): string {
  return fileName.split('.').pop()?.toLowerCase() ?? '';
}

/** Categoría visual de un tipo MIME para mostrar el ícono correcto. */
export type FileCategory = 'pdf' | 'image' | 'word' | 'excel' | 'powerpoint' | 'text' | 'other';

export function getFileCategory(mimeType: string): FileCategory {
  if (mimeType === 'application/pdf') return 'pdf';
  if (mimeType.startsWith('image/')) return 'image';
  if (
    mimeType === 'application/msword' ||
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  )
    return 'word';
  if (
    mimeType === 'application/vnd.ms-excel' ||
    mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  )
    return 'excel';
  if (
    mimeType === 'application/vnd.ms-powerpoint' ||
    mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  )
    return 'powerpoint';
  if (mimeType.startsWith('text/') || mimeType === 'application/csv') return 'text';
  return 'other';
}
