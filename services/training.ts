import { supabase } from '@/lib/supabase';

export type TrainingSession = {
  id: string;
  athlete_id: string;
  session_date: string;
  title: string;
  location: string | null;
  start_time: string | null;
  end_time: string | null;
  notes: string | null;
  created_at?: string;
};

export type NewTrainingSession = {
  athlete_id: string;
  /**
   * Profile ID of the staff member / coach who created the session.
   * Null when the athlete registers their own session via the Training tab.
   * Staff-created sessions always have this populated.
   */
  coach_profile_id?: string | null;
  session_date: string;
  title: string;
  location?: string;
  start_time?: string;
  end_time?: string;
  notes?: string;
};

/** List training sessions for a specific athlete, most recent first. */
export async function listTrainingSessions(athleteId: string): Promise<TrainingSession[]> {
  const { data, error } = await supabase
    .from('training_sessions')
    .select('*')
    .eq('athlete_id', athleteId)
    .order('session_date', { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as TrainingSession[];
}

/** Create a new training session. */
export async function createTrainingSession(
  payload: NewTrainingSession
): Promise<TrainingSession> {
  const { data, error } = await supabase
    .from('training_sessions')
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data as TrainingSession;
}

/** Delete a training session. */
export async function deleteTrainingSession(id: string): Promise<void> {
  const { error } = await supabase
    .from('training_sessions')
    .delete()
    .eq('id', id);
  if (error) throw error;
}
