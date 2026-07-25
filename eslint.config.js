const next = require('eslint-config-next');
const prettier = require('eslint-config-prettier');

module.exports = [
  {
    ignores: [
      'coverage/**',
      'build/**',
      'playwright-report/**',
      'test-results/**',
      'blob-report/**',
      'e2e/.auth/**',
      'node_modules/**',
      '.claude/**',
      'docs/user-guide/site/**',
    ],
  },
  ...next,
  prettier,
  {
    linterOptions: { reportUnusedDisableDirectives: false },
    rules: {
      'react-hooks/set-state-in-effect': 'off',
    },
  },
];
