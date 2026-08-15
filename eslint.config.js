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
      // The mkdocs virtualenv. Gitignored, so CI never sees it, but locally it
      // holds vendored JS that trips the linter — and because `npm run lint` is
      // `eslint && prettier`, that failure stops prettier ever running. Local lint
      // then passes review while CI fails on formatting.
      'docs/user-guide/.venv/**',
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
