import js from '@eslint/js';
import globals from 'globals';
import prettier from 'eslint-config-prettier';

export default [
  {
    ignores: ['**/node_modules/', 'coverage/', 'results/', 'results-dev/', 'infra/cicd/data/'],
  },
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: { ...globals.node },
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      eqeqeq: 'error',
      'prefer-const': 'error',
      'no-var': 'error',
    },
  },
  {
    // Dashboard page: code running in the browser
    files: ['dashboard/public/**/*.js'],
    languageOptions: { globals: { ...globals.browser } },
  },
  prettier,
];
