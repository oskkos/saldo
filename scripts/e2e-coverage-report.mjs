// Turns the raw V8 profiles the end-to-end run leaves behind into one lcov report.
//
// Both runtimes are read: the Next server's NODE_V8_COVERAGE directory and the
// per-test browser profiles written by e2e/fixtures.ts. See
// openspec/specs/coverage-reporting/spec.md for the guarantees this has to keep.

/** The module every spec must take `test` from, and the one file allowed to extend the runner. */
export const FIXTURE_MODULE = 'e2e/fixtures.ts';

// `[^}]*` spans newlines, so a multi-line import block is matched too.
const RUNNER_IMPORT =
  /import\s*\{([^}]*)\}\s*from\s*['"]@playwright\/test['"]/g;

/**
 * Whether this file takes the test function itself from the runner.
 *
 * Only a value import of `test` counts: helpers legitimately import `expect` and
 * `type Page` from the runner, and flagging those would make the guard noise.
 */
function importsRunnerTest(content) {
  for (const [, specifiers] of content.matchAll(RUNNER_IMPORT)) {
    for (const specifier of specifiers.split(',')) {
      const trimmed = specifier.trim();
      if (!trimmed || trimmed.startsWith('type ')) {
        continue;
      }
      // `test as setup` — the imported name is what matters, not the local alias.
      const imported = trimmed.split(/\s+as\s+/)[0].trim();
      if (imported === 'test') {
        return true;
      }
    }
  }

  return false;
}

/**
 * Files that would drop out of browser coverage silently.
 *
 * @param entries `{ file, content }` for each candidate file under `e2e/`.
 * @returns the offending paths, in input order.
 */
export function findUninstrumentedTestFiles(entries) {
  return entries
    .filter(
      ({ file, content }) =>
        file !== FIXTURE_MODULE && importsRunnerTest(content),
    )
    .map(({ file }) => file);
}
