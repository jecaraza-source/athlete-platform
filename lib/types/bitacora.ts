// =============================================================================
// lib/types/bitacora.ts
// Tipos del módulo Bitácora: actividades, fotos, comentarios, narrativas, revista.
// =============================================================================

export type ActivityType    = 'evento_deportivo' | 'consulta';
export type ActivityStatus  = 'borrador' | 'publicado';
export type NarrativeStatus = 'borrador' | 'aprobado' | 'rechazado';
export type MagazineStatus  = 'borrador' | 'publicado';

// ---------------------------------------------------------------------------
// Entidades base
// ---------------------------------------------------------------------------

export interface Activity {
  id:                 string;
  type:               ActivityType;
  title:              string;
  slug:               string;
  description:        string | null;
  event_date:         string | null;   // date → ISO string (YYYY-MM-DD)
  location:           string | null;
  tags:               string[];
  status:             ActivityStatus;
  editorial_eligible: boolean;
  created_by:         string | null;
  notified_at:        string | null;
  created_at:         string;
  updated_at:         string;
}

export interface ActivityPhoto {
  id:            string;
  activity_id:   string;
  storage_path:  string;
  caption:       string | null;
  display_order: number;
  alt_text:      string;
  featured:      boolean;
  created_at:    string;
}

export interface ActivityComment {
  id:           string;
  activity_id:  string;
  author_name:  string;
  author_email: string | null;  // solo visible para admin
  comment:      string;
  approved:     boolean;
  created_at:   string;
}

export interface ActivityNarrative {
  id:             string;
  activity_id:    string;
  narrative_text: string;
  model_used:     string;
  status:         NarrativeStatus;
  generated_at:   string;
  approved_by:    string | null;
  approved_at:    string | null;
}

export interface MagazineIssue {
  id:           string;
  title:        string;
  period_start: string | null;
  period_end:   string | null;
  activity_ids: string[];
  status:       MagazineStatus;
  published_at: string | null;
  notified_at:  string | null;
  created_by:   string | null;
  created_at:   string;
  updated_at:   string;
}

// ---------------------------------------------------------------------------
// Joins y vistas compuestas
// ---------------------------------------------------------------------------

/** Actividad con sus fotos y (opcionalmente) narrativa aprobada. */
export interface ActivityWithRelations extends Activity {
  photos:    ActivityPhoto[];
  /** Narrativa solo si está aprobada (para vistas públicas) o siempre (para admin). */
  narrative: ActivityNarrative | null;
  /** Comentarios aprobados (para vistas públicas) o todos (para admin). */
  comments:  ActivityComment[];
}

/** Datos mínimos para la tarjeta del timeline público. */
export interface ActivityCardData {
  id:              string;
  slug:            string;
  type:            ActivityType;
  title:           string;
  description:     string | null;
  event_date:      string | null;
  location:        string | null;
  tags:            string[];
  /** Primera foto featured, o la primera foto si no hay featured. */
  cover_photo:     ActivityPhoto | null;
  has_narrative:   boolean;  // true si tiene narrativa aprobada
}

/** Artículo de revista: actividad + narrativa aprobada + fotos. */
export interface MagazineArticle {
  activity:  ActivityCardData & { photos: ActivityPhoto[] };
  narrative: ActivityNarrative;
}

// ---------------------------------------------------------------------------
// Filtros
// ---------------------------------------------------------------------------

export interface ActivityFilters {
  type?:    ActivityType;
  tag?:     string;
  /** Año-mes, ej. "2026-07". */
  month?:   string;
  status?:  ActivityStatus;
  page?:    number;
  perPage?: number;
}

// ---------------------------------------------------------------------------
// Inputs de formulario (para Server Actions)
// ---------------------------------------------------------------------------

export interface ActivityInput {
  type:               ActivityType;
  title:              string;
  slug?:              string;  // si está vacío se autogenera
  description?:       string;
  event_date?:        string;
  location?:          string;
  tags?:              string[];
  editorial_eligible?: boolean;
}

export interface PhotoInput {
  storage_path:  string;
  caption?:      string;
  display_order: number;
  alt_text:      string;
  featured:      boolean;
}

export interface CommentInput {
  activity_id:  string;
  author_name:  string;
  author_email?: string;
  comment:      string;
}

// ---------------------------------------------------------------------------
// Respuestas de acciones
// ---------------------------------------------------------------------------

export interface ActionResult<T = undefined> {
  error:  string | null;
  data?:  T;
}
