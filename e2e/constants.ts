import path from 'node:path';

// Where the authenticated session (storageState) is persisted by auth.setup.ts
// and reused by the chromium project. Kept in a non-test module so both the
// Playwright config and the setup file can import it without the config pulling
// a test file into scope.
export const STORAGE_STATE = path.join(__dirname, '.auth', 'user.json');

/** Whether this run collects coverage. One switch drives the build, the server and the browser. */
export const COLLECT_COVERAGE = !!process.env.E2E_COVERAGE;

const COVERAGE_ROOT = path.join(__dirname, '..', 'coverage-e2e');

// Both runtimes write raw V8 profiles here, kept apart so the report step can tell
// which runtime contributed nothing when one of them fails to report.
export const COVERAGE_DIRS = {
  root: COVERAGE_ROOT,
  /** Node writes one profile per process here via NODE_V8_COVERAGE. */
  server: path.join(COVERAGE_ROOT, 'v8-server'),
  /** The page fixture writes one profile per test here. */
  browser: path.join(COVERAGE_ROOT, 'v8-browser'),
  /**
   * Each distinct client chunk's source and map, written once.
   *
   * The suite loads the same ~18 chunks in every test, so storing them per test
   * cost 734 MB for a 44-test run and re-fetched each map 33 times over. Kept out
   * of `browser/` so the report's per-test scan does not pick them up.
   */
  browserScripts: path.join(COVERAGE_ROOT, 'v8-browser-scripts'),
} as const;
