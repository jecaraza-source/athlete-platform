import { supabase } from '@/lib/supabase';

const WEB_URL = (
  process.env.EXPO_PUBLIC_WEB_URL ?? 'https://athlete-platform-blush.vercel.app'
).replace(/\/$/, '');

export type PsychItem = {
  item_code: string;
  item_order: number;
  prompt_text: string;
  response_options: unknown;
};

export type MobileQuestionnaire = {
  assessmentId: string;
  instrumentName: string;
  items: PsychItem[];
};

type SubmissionResult = {
  ok?: boolean;
  error?: string;
  code?: string;
  complete?: boolean;
  message?: string;
};

async function authorizedRequest(path: string, init?: RequestInit) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('No hay sesión activa. Cierra sesión y vuelve a entrar.');
  }

  return fetch(`${WEB_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      ...init?.headers,
    },
  });
}

export async function getPsychQuestionnaire(assessmentId: string): Promise<MobileQuestionnaire> {
  const response = await authorizedRequest(`/api/psych/assessments/${assessmentId}/questionnaire`);
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result.error ?? 'No hay un cuestionario disponible.');
  }
  return result as MobileQuestionnaire;
}

export type PsychologicalHistoryItem = {
  id: string;
  completedAt: string | null;
  instrumentName: string;
  clinicalSummary: string;
};

export async function submitPsychResponses(
  assessmentId: string,
  responses: Array<{ item_code: string; raw_value: string }>,
): Promise<SubmissionResult> {
  const response = await authorizedRequest(`/api/psych/assessments/${assessmentId}/responses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ responses }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result.error ?? `No fue posible registrar tus respuestas (HTTP ${response.status}).`);
  }
  return result as SubmissionResult;
}

export async function listPsychologicalHistory(): Promise<PsychologicalHistoryItem[]> {
  const { data, error } = await supabase.rpc('get_published_psychological_history');
  if (error || !data) throw new Error(error?.message ?? 'No fue posible cargar el histórico.');
  return data.map((row) => ({
    id: row.id,
    completedAt: row.completed_at,
    instrumentName: row.instrument_name ?? 'Instrumento',
    clinicalSummary: row.clinical_summary ?? '',
  }));
}
