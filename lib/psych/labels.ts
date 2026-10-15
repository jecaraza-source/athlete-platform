/**
 * Translates codes stored in the database (subscales, score bands, alert
 * types) through the `psych.common` messages. Codes without a translation
 * fall back to a readable version of the raw value, so new instruments still
 * render before their labels are added.
 */
type CommonTranslator = {
  (key: string): string;
  has(key: string): boolean;
};

export type PsychLabelGroup = 'subscale' | 'band' | 'alertType' | 'instrumentAbout';

export function psychLabel(t: CommonTranslator, group: PsychLabelGroup, value: string): string {
  const key = `${group}.${value.trim().replaceAll(' ', '_')}`;
  return t.has(key) ? t(key) : value.replaceAll('_', ' ');
}

/** BCP 47 tag for date formatting in the app's locales. */
export function psychDateLocale(locale: string): string {
  return locale === 'en' ? 'en-US' : 'es-MX';
}
