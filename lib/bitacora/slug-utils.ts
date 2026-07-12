// =============================================================================
// lib/bitacora/slug-utils.ts
// Generación y validación de slugs únicos para actividades.
// =============================================================================

/**
 * Convierte un texto a slug URL-safe.
 * Ej: "Torneo Nacional de Taekwondo 2026" → "torneo-nacional-de-taekwondo-2026"
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')                   // descomponer tildes
    .replace(/[\u0300-\u036f]/g, '')    // eliminar diacríticos
    .replace(/[^a-z0-9\s-]/g, '')       // solo alfanumérico, espacios y guiones
    .trim()
    .replace(/\s+/g, '-')              // espacios → guión
    .replace(/-+/g, '-')               // guiones múltiples → uno
    .slice(0, 80);                      // máx. 80 caracteres
}

/**
 * Genera un slug único para una actividad verificando contra la BD.
 * Si el slug ya existe, agrega un sufijo numérico: slug-2, slug-3, etc.
 *
 * @param title  - Título de la actividad (fuente del slug base).
 * @param date   - Fecha opcional del evento (YYYY-MM-DD) que se antepone al slug.
 * @param checkFn - Función que retorna true si el slug ya está en uso.
 */
export async function generateUniqueSlug(
  title: string,
  date:    string | null | undefined,
  checkFn: (slug: string) => Promise<boolean>,
): Promise<string> {
  const datePrefix = date ? date.slice(0, 7).replace('-', '-') : ''; // "2026-07"
  const base       = datePrefix ? `${datePrefix}-${slugify(title)}` : slugify(title);

  // Intento inicial sin sufijo
  if (!(await checkFn(base))) return base;

  // Sufijos incrementales hasta encontrar uno libre
  for (let i = 2; i <= 99; i++) {
    const candidate = `${base}-${i}`;
    if (!(await checkFn(candidate))) return candidate;
  }

  // Fallback: agregar timestamp para garantizar unicidad
  return `${base}-${Date.now()}`;
}
