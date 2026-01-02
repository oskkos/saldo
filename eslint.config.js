const next = require('eslint-config-next');
const prettier = require('eslint-config-prettier');

module.exports = [
  {
    ignores: [
      'coverage/**',
      'build/**',
      'playwright-report/**',
      'node_modules/**',
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
