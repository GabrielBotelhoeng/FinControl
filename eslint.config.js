import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig(
  { ignores: ['**/node_modules/**', '**/dist/**', '**/dev-dist/**', '**/coverage/**', '**/generated/**', '.superpowers/**', '.agents/**', '.claude/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.node } },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    // Script do service worker (Web Push), servido como está pela pasta public.
    files: ['apps/web/public/**/*.js'],
    ignores: ['apps/web/public/theme-init.js'],
    languageOptions: { globals: { ...globals.serviceworker } },
  },
  {
    // Script do tema, carregado pelo index.html antes do app (fora dele por causa da CSP).
    files: ['apps/web/public/theme-init.js'],
    languageOptions: { globals: { ...globals.browser } },
  },
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser } },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
);
