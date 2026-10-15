/**
 * Stand-in for next-intl/server in node tests: translators echo the
 * namespaced key so assertions stay independent of the message catalogs.
 */
export function createTranslator(namespace: string) {
  const translate = (key: string) => `${namespace}.${key}`;
  return Object.assign(translate, { has: () => false });
}

export const nextIntlServerMock = {
  getTranslations: async (namespace: string) => createTranslator(namespace),
  getLocale: async () => 'es',
};
