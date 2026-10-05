export type ScoringItem = {
  item_code: string;
  subscale_code: string;
  is_reverse_scored: boolean;
  response_options: unknown;
};

export type ScoringResponse = {
  item_code: string;
  raw_value: string;
};

export type CalculatedScore = {
  subscaleCode: string;
  rawScore: number;
  band: string | null;
};
export function supportsAutomaticScoring(instrumentCode: string): boolean {
  return instrumentCode === 'SCAT';
}

function responseBounds(options: unknown): { min: number; max: number } | null {
  if (!Array.isArray(options)) return null;
  const values = options
    .map((option) => typeof option === 'object' && option !== null && 'value' in option
      ? Number(option.value)
      : Number(option))
    .filter(Number.isFinite);
  if (values.length === 0) return null;
  return { min: Math.min(...values), max: Math.max(...values) };
}

function scatBand(score: number): string {
  if (score < 17) return 'ansiedad competitiva baja';
  if (score <= 24) return 'ansiedad competitiva promedio';
  return 'ansiedad competitiva alta';
}

export function calculatePsychScores(
  instrumentCode: string,
  items: ScoringItem[],
  responses: ScoringResponse[]
): CalculatedScore[] {
  if (!supportsAutomaticScoring(instrumentCode)) return [];

  const responseByItem = new Map(responses.map((response) => [response.item_code, response.raw_value]));
  const totals = new Map<string, number>();

  for (const item of items) {
    if (item.subscale_code === 'unscored') continue;
    const response = Number(responseByItem.get(item.item_code));
    const bounds = responseBounds(item.response_options);
    if (!Number.isFinite(response) || !bounds || response < bounds.min || response > bounds.max) {
      throw new Error(`Invalid response for ${item.item_code}.`);
    }
    const value = item.is_reverse_scored
      ? bounds.min + bounds.max - response
      : response;
    totals.set(item.subscale_code, (totals.get(item.subscale_code) ?? 0) + value);
  }

  return [...totals.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([subscaleCode, rawScore]) => ({
      subscaleCode,
      rawScore,
      band: scatBand(rawScore),
    }));
}
