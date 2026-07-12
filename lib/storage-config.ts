// =============================================================================
// lib/storage-config.ts
// Configuración centralizada de límites de Storage para el módulo Bitácora.
// Ajusta estos valores aquí para que surtan efecto en toda la app.
// Si se migra al plan Pro de Supabase, incrementar MAX_FILE_SIZE_BYTES y
// MAX_PHOTOS_PER_ACTIVITY según convenga.
// =============================================================================

/** Nombre del bucket de Supabase Storage. */
export const ACTIVITY_PHOTOS_BUCKET = 'activity-photos';

/** Tamaño máximo aceptado por el bucket (5 MB). Coincide con el límite SQL. */
export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

/** Target de compresión client-side (en bytes). El uploader rechaza subidas
 *  que superen este valor después de comprimir. */
export const TARGET_COMPRESSED_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB

/** Tamaño mínimo que dispara la compresión (imágenes menores a esto se
 *  suben directamente sin procesar). */
export const COMPRESSION_THRESHOLD_BYTES = 300 * 1024; // 300 KB

/** Calidad JPEG/WebP usada durante la compresión (0-1). */
export const COMPRESSION_QUALITY = 0.8;

/** Dimensiones máximas de la imagen comprimida (preserva aspect ratio). */
export const MAX_IMAGE_DIMENSION = 1920; // px

/** Número máximo de fotos por actividad. */
export const MAX_PHOTOS_PER_ACTIVITY = 25;

/** Tipos MIME aceptados en el uploader. */
export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];

// ---------------------------------------------------------------------------
// Supabase Image Transformation (thumbnails)
// ---------------------------------------------------------------------------

/** Parámetros para el thumbnail usado en tarjetas y timelines. */
export const THUMBNAIL_PARAMS = {
  width:   400,
  quality: 75,
} as const;

/** Parámetros para la imagen hero en la Revista. */
export const HERO_IMAGE_PARAMS = {
  width:   1200,
  quality: 85,
} as const;

/** Parámetros para la imagen en el lightbox (full-size optimizado). */
export const LIGHTBOX_IMAGE_PARAMS = {
  width:   1600,
  quality: 90,
} as const;

// ---------------------------------------------------------------------------
// URL helpers
// ---------------------------------------------------------------------------

/**
 * Construye la URL pública de una foto con transformación de imagen.
 * Requiere que NEXT_PUBLIC_SUPABASE_URL esté definida.
 */
export function getPhotoUrl(
  storagePath: string,
  params?: { width?: number; quality?: number }
): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return '';

  const url = `${base}/storage/v1/object/public/${ACTIVITY_PHOTOS_BUCKET}/${storagePath}`;

  if (!params) return url;

  const { width, quality } = params;
  const search = new URLSearchParams();
  if (width)   search.set('width',   String(width));
  if (quality) search.set('quality', String(quality));

  return `${url}?${search.toString()}`;
}

/** Thumbnail de tarjeta (400px). */
export function getThumbnailUrl(storagePath: string): string {
  return getPhotoUrl(storagePath, THUMBNAIL_PARAMS);
}

/** Imagen hero para la Revista (1200px). */
export function getHeroUrl(storagePath: string): string {
  return getPhotoUrl(storagePath, HERO_IMAGE_PARAMS);
}

/** Imagen full-size para lightbox (1600px). */
export function getLightboxUrl(storagePath: string): string {
  return getPhotoUrl(storagePath, LIGHTBOX_IMAGE_PARAMS);
}
