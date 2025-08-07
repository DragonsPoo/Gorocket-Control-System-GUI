import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import airbnb from 'eslint-config-airbnb-typescript';

export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  airbnb,
  react.configs.recommended,
  reactHooks.configs.recommended,
  jsxA11y.configs.recommended,
  {
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: './tsconfig.json',
      },
    },
    settings: {
      react: { version: 'detect' },
    },
    ignores: ['.next', 'node_modules'],
  },
];
