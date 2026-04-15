import { supabase } from '@/lib/supabase';
import type { Athlete, AthleteStatus } from '@/types';

export type AthleteFilters = {
  status?: AthleteStatus;
  discipline?: string;
  search?: string;
};

/** List athletes with optional filters. */
export async function listAthletes(filters?: AthleteFilters): Promise<Athlete[]> {
  let query = supabase
    .from('athletes')
    .select('*')
    .order('last_name', { ascending: true });

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
