const { defineConfig } = require('eslint/config');
const nextPlugin = require('@next/eslint-plugin-next');
const tsParser = require('@typescript-eslint/parser');

module.exports = defineConfig([
  {
    plugins: { '@next/next': nextPlugin },
    languageOptions: { parser: tsParser },
    rules: {
      ...nextPlugin.configs['core-web-vitals'].rules,
    },
  },
  {
    ignores: ['dist/*', '.next/*', 'node_modules/*'],
  },
]);
