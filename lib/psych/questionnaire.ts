/**
 * Columns of psych_instrument_items that may be sent to an athlete. The
 * scoring key (subscale_code, is_reverse_scored) stays server-side so the
 * athlete cannot derive scores or bands before clinical review.
 */
export const ATHLETE_ITEM_COLUMNS = 'item_code, item_order, prompt_text, response_options';

export type AthleteQuestionnaireItem = {
  item_code: string;
  item_order: number;
  prompt_text: string;
  response_options: unknown;
};
