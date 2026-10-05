import type { ScoringItem, ScoringResponse } from '@/lib/psych/scoring';

function allowedValues(responseOptions: unknown): Set<string> {
  if (!Array.isArray(responseOptions)) return new Set();

  return new Set(responseOptions.flatMap((option) => {
    if (typeof option === 'string' || typeof option === 'number') {
      return [String(option)];
    }
    if (
      option &&
      typeof option === 'object' &&
      'value' in option &&
      (typeof option.value === 'string' || typeof option.value === 'number')
    ) {
      return [String(option.value)];
    }
    return [];
  }));
}

export function validatePsychSubmission(
  items: ScoringItem[],
  responses: ScoringResponse[]
): { error?: string } {
  if (responses.length !== items.length) {
    return { error: 'Debes responder todos los reactivos exactamente una vez.' };
  }

  const itemByCode = new Map(items.map((item) => [item.item_code, item]));
  const seenCodes = new Set<string>();

  for (const response of responses) {
    if (seenCodes.has(response.item_code)) {
      return { error: `El reactivo ${response.item_code} se envió más de una vez.` };
    }
    seenCodes.add(response.item_code);

    const item = itemByCode.get(response.item_code);
    if (!item) {
      return { error: `El reactivo ${response.item_code} no pertenece a esta evaluación.` };
    }
    if (!allowedValues(item.response_options).has(response.raw_value)) {
      return { error: `La respuesta del reactivo ${response.item_code} no es válida.` };
    }
  }

  return {};
}
