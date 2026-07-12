import { supabase } from '@/lib/supabase';
import type { Athlete, AthleteStatus } from '@/types';

export type AthleteFilters = {
  status?: AthleteStatus;
  discipline?: string;
  search?: string;
  /** Zero-based page index (default 0). */
  page?: number;
  /** Rows per page (default 30). */
  pageSize?: number;
};

/** List athletes with optional filters and pagination. */
export async function listAthletes(filters?: AthleteFilters): Promise<Athlete[]> {
  const pageSize = filters?.pageSize ?? 30;
  const page     = filters?.page     ?? 0;

  let query = supabase
    .from('athletes')
    .select('*')
    .order('last_name', { ascending: true })
    .range(page * pageSize, (page + 1) * pageSize - 1);

  if (filters?.status) {
    query = query.eq('status', filters.status);
  }
  if (filters?.discipline) {
    query = query.eq('discipline', filters.discipline);
  }
  if (filters?.search) {
    const s = `%${filters.search}%`;
    query = query.or(`first_name.ilike.${s},last_name.ilike.${s},athlete_code.ilike.${s}`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Athlete[];
}

/** Get a single athlete by ID. */
export async function getAthlete(id: string): Promise<Athlete | null> {
  const { data, error } = await supabase
    .from('athletes')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data as Athlete | null;
}

/** Get the athlete linked to a profile (for athlete-role users). */
export async function getAthleteByProfileId(profileId: string): Promise<Athlete | null> {
  const { data, error } = await supabase
    .from('athletes')
    .select('*')
    .eq('profile_id', profileId)
    .maybeSingle();
  if (error) throw error;
  return data as Athlete | null;
}

/**
 * Get the athlete whose login email matches.
 * Primary lookup for athlete-role users — requires athletes.email to be set
 * in the admin (Atletas → Información General → Email de acceso móvil).
 */
export async function getAthleteByEmail(email: string): Promise<Athlete | null> {
  try {
    const { data, error } = await supabase
      .from('athletes')
      .select('*')
      .eq('email', email)
      .maybeSingle();
    if (error) return null; // column may not exist yet (pending migration)
    return data as Athlete | null;
  } catch {
    return null;
  }
}

/** Count athletes by status. */
export async function countAthletes(): Promise<{ total: number; activos: number }> {
  const { count: total } = await supabase
    .from('athletes')
    .select('*', { count: 'exact', head: true });
  const { count: activos } = await supabase
    .from('athletes')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'active'); // DB stores English values
  return { total: total ?? 0, activos: activos ?? 0 };
}
