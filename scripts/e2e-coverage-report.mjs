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
export function isProjectSource(sourcePath, repoRoot, baseDir = repoRoot) {
  const absolute = path.resolve(baseDir, sourcePath);
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

/**
 * Whether a server-side script's map names any of our sources.
 *
 * Needed because a script with no *project* source is still reported — as itself.
 * Turbopack's per-route entry points are thin loaders with empty maps, so without
 * this the report fills up with the built `page.js` files under `build/server/app/`,
 * which pass the resolves-on-disk check precisely because the build output exists.
 *
 * Server maps name their sources relative to the map, so they resolve against the
 * map's directory rather than the repository root. Browser entries are filtered
 * before they get here and pass through.
 */
export function entryCoversProjectSource(url, repoRoot) {
  if (!url.startsWith('file://')) {
    return true;
  }

  let mapPath;
  try {
    mapPath = `${fileURLToPath(url)}.map`;
  } catch {
    return false;
  }
  if (!fs.existsSync(mapPath)) {
    return false;
  }

  let sourceMap;
  try {
    sourceMap = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
  } catch {
    return false;
  }

  const baseDir = path.dirname(mapPath);
  return sourceMapSources(sourceMap).some((source) =>
    isProjectSource(normaliseSourcePath(source), repoRoot, baseDir),
  );
}

/**
 * Every source a map names, flat or sectioned.
 *
 * Turbopack emits *indexed* maps for its chunks: the top-level `sources` array is
 * empty and the real paths live under `sections[].map.sources`. Reading only the
 * top level makes every chunk look sourceless.
 */
export function sourceMapSources(sourceMap) {
  if (!sourceMap) {
    return [];
  }
  if (Array.isArray(sourceMap.sections)) {
    return sourceMap.sections.flatMap((section) => section.map?.sources ?? []);
  }
  return sourceMap.sources ?? [];
}

/**
 * Browser entries worth converting, with their maps inlined.
 *
 * Two things happen here, both learned the hard way against real profiles:
 *
 * Chunks whose map names none of our sources are dropped. A framework-only chunk
 * otherwise reaches the report as its own URL — `localhost-3100/_next/static/...` —
 * because an entry with no *project* source is reported as a dist file, and
 * `sourceFilter` is never consulted for it.
 *
 * The map is then inlined into the source as a data URI rather than passed as an
 * object, because the object path cannot handle indexed maps: it fails inside the
 * converter with "Cannot destructure property 'length'". The data URI takes the same
 * route a map fetched over HTTP would.
 */
export function prepareBrowserEntries(entries, repoRoot) {
  return entries
    .filter((entry) =>
      sourceMapSources(entry.sourceMap).some((source) =>
        isProjectSource(normaliseSourcePath(source), repoRoot),
      ),
    )
    .map(({ sourceMap, ...entry }) => ({
      ...entry,
      source: entry.source?.replace(
        /\/\/# sourceMappingURL=\S+/,
        `//# sourceMappingURL=data:application/json;base64,${Buffer.from(
          JSON.stringify(sourceMap),
        ).toString('base64')}`,
      ),
    }));
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
    // Unmapped scripts never reach sourceFilter — they are reported as themselves —
    // so they are dropped here, by origin and by whether they carry any of our
    // source at all.
    entryFilter: (entry) =>
      isOwnEntryUrl(entry.url, repoRoot) &&
      entryCoversProjectSource(entry.url, repoRoot),
  });

  await load(report);
  await report.generate();

  const lcovPath = path.join(outputDir, 'lcov.info');

  // No lcov at all and an lcov naming nothing of ours are the same condition to
  // whoever has to fix it: this runtime covered none of our code.
  const files = fs.existsSync(lcovPath)
    ? fs
        .readFileSync(lcovPath, 'utf8')
        .split('\n')
        .filter((line) => line.startsWith('SF:'))
        .map((line) => line.slice(3))
    : [];

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
        // The browser profiles carry each script's source and the map the fixture
        // fetched while the server was still up, so they add directly.
        await buildRuntimeReport({
          repoRoot,
          runtime: 'browser',
          outputDir: path.join(outputDir, 'browser'),
          load: (report) =>
            report.add(prepareBrowserEntries(browserEntries, repoRoot)),
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
