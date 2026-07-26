// Turns the raw V8 profiles the end-to-end run leaves behind into one lcov report.
//
// Both runtimes are read: the Next server's NODE_V8_COVERAGE directory and the
// per-test browser profiles written by e2e/fixtures.ts. See
// openspec/specs/coverage-reporting/spec.md for the guarantees this has to keep.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

// --- report generation -------------------------------------------------------

/**
 * Strip the prefix a bundler puts on a source path.
 *
 * Turbopack's client chunk maps name sources `turbopack:///[project]/src/x.tsx`,
 * and webpack's `webpack://_N_E/./src/x.tsx`. Server chunk maps instead use paths
 * relative to the map, which monocart has already resolved by the time this runs —
 * those arrive repository-relative and pass through untouched.
 */
export function normaliseSourcePath(sourcePath) {
  const bundled = /(?:\[project\]|_N_E)\/\.?\/?(.*)$/.exec(sourcePath);
  return bundled ? bundled[1] : sourcePath;
}

/**
 * Whether a normalised path is one of this repository's own sources.
 *
 * Resolving against the repo root and requiring the file to exist is what
 * separates our `src/` from Next's: Next ships source maps referencing its own
 * `src/` tree, so a prefix test alone silently pulls its internals into the
 * report. Generated code is excluded to match Jest's `collectCoverageFrom`.
 */
export function isProjectSource(sourcePath, repoRoot) {
  const absolute = path.resolve(repoRoot, sourcePath);
  return (
    absolute.startsWith(path.join(repoRoot, 'src') + path.sep) &&
    !absolute.startsWith(path.join(repoRoot, 'src', 'generated') + path.sep) &&
    fs.existsSync(absolute)
  );
}

/**
 * Whether a covered script is one this application shipped.
 *
 * Needed as well as `isProjectSource` because a script without a source map never
 * reaches source-level filtering: Node's own internals, and any unrelated process
 * that inherited NODE_V8_COVERAGE, arrive as entries. In the spike an `npx`
 * wrapper put 740 files of npm's own source into the report this way.
 */
export function isOwnEntryUrl(url, repoRoot) {
  if (!url) {
    return false;
  }
  if (url.startsWith('file://')) {
    try {
      return fileURLToPath(url).startsWith(repoRoot + path.sep);
    } catch {
      return false;
    }
  }
  // The app's client bundles are the only http(s) scripts worth reading.
  return url.includes('/_next/');
}

/** JSON files in a directory, or [] when the directory is absent. */
function readProfiles(dir) {
  if (!fs.existsSync(dir)) {
    return [];
  }
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .map((name) => JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8')));
}

/**
 * Convert one runtime's V8 profiles into an lcov report.
 *
 * One report per runtime, deliberately, rather than one merged report: monocart
 * resolves both runtimes to the same source path but does not union their function
 * counts, so a `count: 0` from the server masks a hit from the browser for every
 * file both runtimes touch — shared code like src/util/date.ts, and every client
 * component that is server-rendered and then hydrated. Two reports under one flag
 * let the coverage service do the union, which it does correctly.
 */
async function buildRuntimeReport({ repoRoot, runtime, outputDir, load }) {
  const { CoverageReport } = await import('monocart-coverage-reports');

  const report = new CoverageReport({
    name: `Saldo end-to-end coverage (${runtime})`,
    outputDir,
    reports: ['lcovonly'],
    baseDir: repoRoot,
    cleanCache: true,
    sourcePath: (sourcePath) => normaliseSourcePath(sourcePath),
    sourceFilter: (sourcePath) => isProjectSource(sourcePath, repoRoot),
    // Unmapped scripts never reach sourceFilter, so they are dropped by origin here.
    entryFilter: (entry) => isOwnEntryUrl(entry.url, repoRoot),
  });

  await load(report);
  await report.generate();

  const lcovPath = path.join(outputDir, 'lcov.info');
  if (!fs.existsSync(lcovPath)) {
    throw new Error(`Report generation wrote no lcov to ${lcovPath}.`);
  }

  const files = fs
    .readFileSync(lcovPath, 'utf8')
    .split('\n')
    .filter((line) => line.startsWith('SF:'))
    .map((line) => line.slice(3));

  if (files.length === 0) {
    throw new Error(
      `The ${runtime} profiles contain no project source. That runtime reported data, so this ` +
        'is a source-map or filtering failure rather than a collection one — check that the ' +
        'build ran with E2E_COVERAGE=1 so source maps were emitted.',
    );
  }

  // A path that does not resolve would still upload cleanly and render as a second
  // file tree beside the real one, merging with nothing. Unreachable while
  // isProjectSource checks the filesystem; kept because that is one edit away.
  const unresolved = files.filter(
    (file) => !fs.existsSync(path.resolve(repoRoot, file)),
  );
  if (unresolved.length > 0) {
    throw new Error(
      `The ${runtime} report names ${unresolved.length} path(s) that do not resolve under ` +
        `${repoRoot}:\n${unresolved.map((file) => `  ${file}`).join('\n')}`,
    );
  }

  return { runtime, lcovPath, files };
}

/**
 * Convert the raw V8 profiles both runtimes left behind into lcov reports.
 *
 * Throws rather than writing a thin report: collection depends on process
 * shutdown and on source maps resolving, and both fail quietly. A red build is
 * the only failure mode that cannot be mistaken for "coverage went down a bit".
 */
export async function generateReport({
  repoRoot,
  serverDir,
  browserDir,
  outputDir,
}) {
  // Node writes one profile per process, so unrelated processes that inherited
  // NODE_V8_COVERAGE land here too; a profile counts only if it holds scripts.
  const serverEntries = readProfiles(serverDir).flatMap(
    (profile) => profile.result ?? [],
  );
  const browserEntries = readProfiles(browserDir).flatMap(
    (profile) => profile.entries ?? [],
  );

  if (serverEntries.length === 0) {
    throw new Error(
      `No server coverage in ${serverDir}. The app server writes its V8 profile on shutdown — ` +
        'if it was killed outright, or E2E_COVERAGE was unset for the run, there is nothing to report.',
    );
  }
  if (browserEntries.length === 0) {
    throw new Error(
      `No browser coverage in ${browserDir}. Every spec must take its test function from ` +
        `${FIXTURE_MODULE}, which is what starts the browser profiler.`,
    );
  }

  // Server chunk maps name their sources relative to the map, and those relative
  // paths are resolved against the working directory — not against baseDir. Made
  // explicit here rather than left as a latent requirement that the caller happens
  // to satisfy by running from the repository root.
  const originalCwd = process.cwd();
  process.chdir(repoRoot);
  try {
    return {
      reports: [
        // The server profiles only name a file:// URL, so monocart has to read the
        // script and its map off disk — which addFromDir does and add() does not.
        await buildRuntimeReport({
          repoRoot,
          runtime: 'server',
          outputDir: path.join(outputDir, 'server'),
          load: (report) => report.addFromDir(serverDir),
        }),
        // The browser profiles carry each script's source, so they add directly.
        await buildRuntimeReport({
          repoRoot,
          runtime: 'browser',
          outputDir: path.join(outputDir, 'browser'),
          load: (report) => report.add(browserEntries),
        }),
      ],
    };
  } finally {
    process.chdir(originalCwd);
  }
}

// --- CLI ---------------------------------------------------------------------

// Run after `playwright test` has exited, not from a reporter or teardown: the app
// server only writes its profile when Playwright kills it, which happens during
// Playwright's own shutdown.
/** Generate both reports into `coverage-e2e/`, or exit non-zero explaining why not. */
export async function main(repoRoot) {
  const root = path.join(repoRoot, 'coverage-e2e');

  const { reports } = await generateReport({
    repoRoot,
    serverDir: path.join(root, 'v8-server'),
    browserDir: path.join(root, 'v8-browser'),
    outputDir: root,
  });

  return reports
    .map(
      ({ runtime, lcovPath, files }) =>
        `${runtime}: ${files.length} source files -> ${path.relative(repoRoot, lcovPath)}`,
    )
    .join('\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  // No top-level await: this module is imported by Jest's CommonJS transform.
  main(process.cwd()).then(
    (output) => console.log(output),
    (error) => {
      console.error(error.message);
      process.exit(1);
    },
  );
}
