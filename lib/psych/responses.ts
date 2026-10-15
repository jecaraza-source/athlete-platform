/**
 * Joins an assessment's raw answers with its instrument items so clinicians
 * can grade manually: each answer carries the prompt, the chosen option label
 * and the scoring metadata. No score is computed here.
 */

export type ReviewItem = {
  item_code: string;
  item_order: number;
  prompt_text: string;
  response_options: unknown;
  subscale_code: string;
  is_reverse_scored: boolean;
};

export type ReviewResponse = {
  item_code: string;
  raw_value: string;
  created_at: string;
};

export type ReadableResponse = {
  itemCode: string;
  itemOrder: number | null;
  prompt: string | null;
  answerLabel: string;
  rawValue: string;
  subscaleCode: string | null;
  isReverseScored: boolean;
  createdAt: string;
};

function optionLabel(options: unknown, rawValue: string): string | null {
  if (!Array.isArray(options)) return null;
  for (const option of options) {
    if ((typeof option === 'string' || typeof option === 'number') && String(option) === rawValue) {
      return String(option);
    }
    if (option && typeof option === 'object' && 'value' in option && String(option.value) === rawValue) {
      return 'label' in option && typeof option.label === 'string' ? option.label : rawValue;
    }
  }
  return null;
}

export function buildReadableResponses(items: ReviewItem[], responses: ReviewResponse[]): ReadableResponse[] {
  const itemByCode = new Map(items.map((item) => [item.item_code, item]));
  return responses
    .map((response) => {
      const item = itemByCode.get(response.item_code);
      return {
        itemCode: response.item_code,
        itemOrder: item?.item_order ?? null,
        prompt: item?.prompt_text ?? null,
        answerLabel: optionLabel(item?.response_options, response.raw_value) ?? response.raw_value,
        rawValue: response.raw_value,
        subscaleCode: item && item.subscale_code !== 'unscored' ? item.subscale_code : null,
        isReverseScored: item?.is_reverse_scored ?? false,
        createdAt: response.created_at,
      };
    })
    .sort((left, right) =>
      (left.itemOrder ?? Number.MAX_SAFE_INTEGER) - (right.itemOrder ?? Number.MAX_SAFE_INTEGER) ||
      left.itemCode.localeCompare(right.itemCode)
    );
}
