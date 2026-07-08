'use client';
// =============================================================================
// lib/bitacora/image-utils.ts
// Compresión de imágenes client-side usando Canvas API antes del upload.
// Solo se usa en el cliente — nunca importar en Server Components.
// =============================================================================

import {
  COMPRESSION_QUALITY,
  COMPRESSION_THRESHOLD_BYTES,
  MAX_IMAGE_DIMENSION,
  TARGET_COMPRESSED_SIZE_BYTES,
} from '@/lib/storage-config';

export interface CompressResult {
  file:         File;
  originalSize: number;
  finalSize:    number;
  wasCompressed: boolean;
}

/**
 * Comprime una imagen usando Canvas.
 * - Si el archivo ya es menor que COMPRESSION_THRESHOLD_BYTES, lo devuelve sin cambios.
 * - Reduce las dimensiones si algún lado supera MAX_IMAGE_DIMENSION.
 * - Renderiza a JPEG con COMPRESSION_QUALITY.
 * - Itera bajando calidad hasta llegar al TARGET_COMPRESSED_SIZE_BYTES.
 */
export async function compressImage(file: File): Promise<CompressResult> {
  const originalSize = file.size;

  // Saltar compresión para archivos pequeños
  if (originalSize <= COMPRESSION_THRESHOLD_BYTES) {
    return { file, originalSize, finalSize: originalSize, wasCompressed: false };
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      // Calcular dimensiones con aspect ratio preservado
      let { width, height } = img;
      if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
        if (width > height) {
          height = Math.round((height * MAX_IMAGE_DIMENSION) / width);
          width  = MAX_IMAGE_DIMENSION;
        } else {
          width  = Math.round((width * MAX_IMAGE_DIMENSION) / height);
          height = MAX_IMAGE_DIMENSION;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width  = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('No se pudo crear el contexto de canvas'));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);

      // Intentar comprimir bajando calidad hasta llegar al target
      const outputType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
      let quality = COMPRESSION_QUALITY;
      let blob: Blob | null = null;

      const tryCompress = (q: number) => {
        canvas.toBlob(
          (b) => {
            if (!b) {
              reject(new Error('Error al comprimir la imagen'));
              return;
            }

            // Si todavía es grande y tenemos margen de calidad, volver a intentar
            if (b.size > TARGET_COMPRESSED_SIZE_BYTES && q > 0.4) {
              tryCompress(q - 0.1);
              return;
            }

            blob = b;
            const ext       = outputType === 'image/png' ? 'png' : 'jpg';
            const baseName  = file.name.replace(/\.[^.]+$/, '');
            const compressed = new File([blob], `${baseName}.${ext}`, { type: outputType });

            resolve({
              file:          compressed,
              originalSize,
              finalSize:     compressed.size,
              wasCompressed: true,
            });
          },
          outputType,
          q,
        );
      };

      tryCompress(quality);
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('No se pudo leer la imagen'));
    };

    img.src = objectUrl;
  });
}

/**
 * Convierte un File a base64 (data URL) para previsualización o envío a la API.
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Error al leer el archivo'));
    reader.readAsDataURL(file);
  });
}

/**
 * Extrae el contenido base64 puro de un data URL (sin el prefijo "data:...;base64,").
 */
export function dataUrlToBase64(dataUrl: string): string {
  return dataUrl.split(',')[1] ?? '';
}

/**
 * Formatea el tamaño de un archivo en bytes a una cadena legible.
 * Ej: 812034 → "793 KB"
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024)        return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
