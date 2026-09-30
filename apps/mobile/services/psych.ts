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
};

const ALLOW_TECHNICAL_FIXTURES = process.env.EXPO_PUBLIC_PSYCH_ALLOW_TEST_FIXTURES === 'true';
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
  if (!response.ok && !(response.status === 501 && result.code === 'PSYCH_SCORING_NOT_IMPLEMENTED')) {
    throw new Error(result.error ?? `No fue posible registrar tus respuestas (HTTP ${response.status}).`);
  }
  return result as SubmissionResult;
}

export async function listPsychologicalHistory(): Promise<PsychologicalHistoryItem[]> {
  let query = supabase
    .from('psych_assessments')
    .select('id, completed_at, psych_instruments!inner(name, is_test_only)')
    .eq('published_to_athlete', true)
    .order('completed_at', { ascending: false });
  if (!ALLOW_TECHNICAL_FIXTURES) {
    query = query.eq('psych_instruments.is_test_only', false);
  }

  const { data, error } = await query;
  if (error || !data) throw new Error(error?.message ?? 'No fue posible cargar el histórico.');

  return data.map((row) => {
    const instrument = Array.isArray(row.psych_instruments)
      ? row.psych_instruments[0]
      : row.psych_instruments;
    return {
      id: row.id,
      completedAt: row.completed_at,
      instrumentName: instrument?.name ?? 'Instrumento',
    };
  });
}
