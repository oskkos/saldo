import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';

import { generateReport } from '../e2e-coverage-report.mjs';

// Exercises the conversion against synthetic profiles rather than mocks: a real
// bundle, a real source map, and V8 profiles in the exact shapes the two runtimes
// produce — Node's NODE_V8_COVERAGE files and the per-test files e2e/fixtures.ts
// writes. Anything less would assert our idea of the format instead of the format.

/** Two functions, so each runtime can cover a different one and the union is visible. */
const SOURCE = [
  'export function first() {',
  "  return 'first';",
  '}',
  'export function second() {',
  "  return 'second';",
  '}',
  '',
].join('\n');

// An identity map: the bundle is the source verbatim, so every generated line maps
// to the same source line. 'AAAA' is (col 0, source 0, line 0, col 0) and each
// 'AACA' that follows advances the source line by one.
const identityMappings = (lineCount: number) =>
  ['AAAA', ...Array(lineCount - 1).fill('AACA')].join(';');

type Project = { root: string; bundle: string; bundlePath: string };

let project: Project;

const setUpProject = (): Project => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'saldo-e2e-cov-'));
  fs.mkdirSync(path.join(root, 'src'));
  fs.writeFileSync(path.join(root, 'src', 'greet.ts'), SOURCE);

  const map = {
    version: 3,
    file: 'bundle.js',
    sources: ['../src/greet.ts'],
    sourcesContent: [SOURCE],
    names: [],
    mappings: identityMappings(SOURCE.split('\n').length),
  };

  const dist = path.join(root, 'dist');
  fs.mkdirSync(dist);
  fs.writeFileSync(path.join(dist, 'bundle.js.map'), JSON.stringify(map));
  const bundle = `${SOURCE}//# sourceMappingURL=bundle.js.map\n`;
  fs.writeFileSync(path.join(dist, 'bundle.js'), bundle);

  fs.mkdirSync(path.join(root, 'v8-server'), { recursive: true });
  fs.mkdirSync(path.join(root, 'v8-browser'), { recursive: true });

  return { root, bundle, bundlePath: path.join(dist, 'bundle.js') };
};

/** A V8 function range covering the named function's body, hit `count` times. */
const range = (bundle: string, fn: 'first' | 'second', count: number) => {
  const startOffset = bundle.indexOf(`export function ${fn}()`);
  const endOffset = bundle.indexOf('}', startOffset) + 1;
  return {
    functionName: fn,
    isBlockCoverage: false,
    ranges: [{ startOffset, endOffset, count }],
  };
};

/**
 * The script-level range V8 always emits first.
 *
 * Without it the first named function is read as the script root and its count
 * applies to everything, which made results depend on array order — an artifact of
 * the fixture rather than anything the report does.
 */
const rootRange = (bundle: string) => ({
  functionName: '',
  isBlockCoverage: false,
  ranges: [{ startOffset: 0, endOffset: bundle.length, count: 1 }],
});

/** Both named functions, in a fixed order, so only the counts differ between runtimes. */
const functionsFor = (
  bundle: string,
  counts: { first: number; second: number },
) => [
  rootRange(bundle),
  range(bundle, 'first', counts.first),
  range(bundle, 'second', counts.second),
];

const writeServerProfile = (
  { root, bundle, bundlePath }: Project,
  counts: { first: number; second: number },
  { extraScripts = [] as string[] } = {},
) =>
  fs.writeFileSync(
    path.join(root, 'v8-server', 'coverage-1-1-0.json'),
    JSON.stringify({
      result: [
        {
          scriptId: '1',
          url: pathToFileURL(bundlePath).href,
          functions: functionsFor(bundle, counts),
        },
        ...extraScripts.map((script, index) => {
          const text = fs.readFileSync(script, 'utf8');
          return {
            scriptId: String(index + 2),
            url: pathToFileURL(script).href,
            functions: functionsFor(text, { first: 1, second: 0 }),
          };
        }),
      ],
    }),
  );

const writeBrowserProfile = (
  { root, bundle }: Project,
  counts: { first: number; second: number },
  { url = 'http://localhost:3100/_next/static/chunks/bundle.js' } = {},
) => {
  // The browser has no file to read, so the map rides along as a data URI exactly
  // as Turbopack's client bundles carry theirs.
  const map = fs.readFileSync(path.join(root, 'dist', 'bundle.js.map'), 'utf8');
  const inlined = `${SOURCE}//# sourceMappingURL=data:application/json;base64,${Buffer.from(map).toString('base64')}\n`;

  fs.writeFileSync(
    path.join(root, 'v8-browser', '1-0.json'),
    JSON.stringify({
      testTitle: 'synthetic',
      entries: [
        {
          url,
          source: inlined,
          functions: functionsFor(bundle, counts),
        },
      ],
    }),
  );
};

const run = (overrides: Record<string, unknown> = {}) =>
  generateReport({
    repoRoot: project.root,
    serverDir: path.join(project.root, 'v8-server'),
    browserDir: path.join(project.root, 'v8-browser'),
    outputDir: path.join(project.root, 'report'),
    ...overrides,
  });

/** Covered lines for one runtime's report, keyed by `SF:` path. */
const linesFor = (
  result: { reports: { runtime: string; lcovPath: string }[] },
  runtime: 'server' | 'browser',
) => {
  const report = result.reports.find((entry) => entry.runtime === runtime);
  if (!report) throw new Error(`no ${runtime} report`);
  return coveredLines(report.lcovPath);
};

/** Every path either runtime reported. */
const allReportedFiles = (result: {
  reports: { runtime: string; files: string[] }[];
}) => result.reports.flatMap((report) => report.files);

/** `SF:` path -> covered line numbers, read back out of the generated lcov. */
const coveredLines = (lcovPath: string) => {
  const byFile: Record<string, number[]> = {};
  let current = '';
  for (const line of fs.readFileSync(lcovPath, 'utf8').split('\n')) {
    if (line.startsWith('SF:')) {
      current = line.slice(3);
      byFile[current] = [];
    } else if (line.startsWith('DA:')) {
      const [lineNo, hits] = line.slice(3).split(',').map(Number);
      if (hits > 0) byFile[current].push(lineNo);
    }
  }
  return byFile;
};

beforeEach(() => {
  project = setUpProject();
});

afterEach(() => {
  fs.rmSync(project.root, { recursive: true, force: true });
});

describe('both runtimes reach the report', () => {
  // @scenario coverage-reporting/Server-executed code appears in the report
  it('records a source file executed on the server', async () => {
    writeServerProfile(project, { first: 1, second: 0 });
    writeBrowserProfile(project, { first: 0, second: 0 });

    const covered = linesFor(await run(), 'server');

    expect(Object.keys(covered)).toEqual(['src/greet.ts']);
    expect(covered['src/greet.ts']).toContain(2);
  });

  // @scenario coverage-reporting/Browser-executed code appears in the report
  it('records a source file executed in the browser', async () => {
    writeServerProfile(project, { first: 0, second: 0 });
    writeBrowserProfile(project, { first: 0, second: 1 });

    const covered = linesFor(await run(), 'browser');

    expect(covered['src/greet.ts']).toContain(5);
  });

  // @scenario coverage-reporting/A file executed in both runtimes is reported once
  it('reports a file executed in both runtimes once, as the union', async () => {
    writeServerProfile(project, { first: 1, second: 0 });
    writeBrowserProfile(project, { first: 0, second: 1 });

    const result = await run();

    // Each runtime reports the file once, and between them every executed line is
    // covered: line 2 from the server, line 5 from the browser. The union is left
    // to the coverage service because monocart's merge would let one runtime's
    // zero mask the other's hit.
    expect(linesFor(result, 'server')['src/greet.ts']).toContain(2);
    expect(linesFor(result, 'browser')['src/greet.ts']).toContain(5);
    expect(new Set(allReportedFiles(result))).toEqual(
      new Set(['src/greet.ts']),
    );
  });
});

describe('paths match the repository layout', () => {
  // @scenario coverage-reporting/Bundler-prefixed source paths are normalised
  it('strips the bundler prefix Turbopack puts on client sources', async () => {
    writeServerProfile(project, { first: 1, second: 0 });
    // Rewrite the inlined map to the prefixed form Turbopack actually emits.
    writeBrowserProfile(project, { first: 0, second: 1 });
    const profile = path.join(project.root, 'v8-browser', '1-0.json');
    const raw = fs.readFileSync(profile, 'utf8');
    const decoded = JSON.parse(raw) as {
      entries: { source: string }[];
    };
    const map = JSON.parse(
      fs.readFileSync(path.join(project.root, 'dist', 'bundle.js.map'), 'utf8'),
    ) as { sources: string[] };
    map.sources = ['turbopack:///[project]/src/greet.ts'];
    decoded.entries[0].source = `${SOURCE}//# sourceMappingURL=data:application/json;base64,${Buffer.from(
      JSON.stringify(map),
    ).toString('base64')}\n`;
    fs.writeFileSync(profile, JSON.stringify(decoded));

    const covered = linesFor(await run(), 'browser');

    expect(Object.keys(covered)).toEqual(['src/greet.ts']);
  });

  // @scenario coverage-reporting/A path that does not resolve stays out of the report
  it('keeps a path that names no file on disk out of the report', async () => {
    writeServerProfile(project, { first: 1, second: 0 });
    writeBrowserProfile(project, { first: 0, second: 1 });
    // The only source the maps point at does not exist, which is what an
    // unstripped bundler prefix looks like by the time it reaches the filter.
    fs.rmSync(path.join(project.root, 'src', 'greet.ts'));

    // Excluded rather than published — and with nothing left, the run fails
    // instead of uploading an empty report.
    await expect(run()).rejects.toThrow(/no project source/i);
  });
});

describe('report scope matches the unit layer', () => {
  // @scenario coverage-reporting/Only project sources are reported
  it('excludes sources outside src/', async () => {
    // A second script, mapped to a real file outside src/ — the shape a bundled
    // dependency takes when it carries its own source map.
    fs.mkdirSync(path.join(project.root, 'vendor'));
    fs.writeFileSync(path.join(project.root, 'vendor', 'dep.ts'), SOURCE);
    const vendorMap = {
      version: 3,
      file: 'vendor.js',
      sources: ['../vendor/dep.ts'],
      sourcesContent: [SOURCE],
      names: [],
      mappings: identityMappings(SOURCE.split('\n').length),
    };
    const dist = path.join(project.root, 'dist');
    fs.writeFileSync(
      path.join(dist, 'vendor.js.map'),
      JSON.stringify(vendorMap),
    );
    fs.writeFileSync(
      path.join(dist, 'vendor.js'),
      `${SOURCE}//# sourceMappingURL=vendor.js.map\n`,
    );

    writeServerProfile(
      project,
      { first: 1, second: 0 },
      {
        extraScripts: [path.join(dist, 'vendor.js')],
      },
    );
    writeBrowserProfile(project, { first: 0, second: 1 });

    const reported = allReportedFiles(await run());

    expect(reported).toContain('src/greet.ts');
    expect(reported).not.toContain('vendor/dep.ts');
  });

  // @scenario coverage-reporting/Generated code is excluded
  it('excludes the generated database client', async () => {
    const generated = path.join(project.root, 'src', 'generated', 'prisma');
    fs.mkdirSync(generated, { recursive: true });
    fs.writeFileSync(path.join(generated, 'client.ts'), SOURCE);
    const map = {
      version: 3,
      file: 'bundle.js',
      sources: ['../src/generated/prisma/client.ts'],
      sourcesContent: [SOURCE],
      names: [],
      mappings: identityMappings(SOURCE.split('\n').length),
    };
    fs.writeFileSync(
      path.join(project.root, 'dist', 'bundle.js.map'),
      JSON.stringify(map),
    );
    writeServerProfile(project, { first: 1, second: 0 });
    writeBrowserProfile(project, { first: 0, second: 1 });

    await expect(run()).rejects.toThrow(/no project source/i);
  });
});

describe('an empty or partial report fails the run', () => {
  // @scenario coverage-reporting/A missing server profile fails the run
  it('fails when the server contributed nothing', async () => {
    writeBrowserProfile(project, { first: 1, second: 0 });

    await expect(run()).rejects.toThrow(/server/i);
  });

  // @scenario coverage-reporting/A missing browser profile fails the run
  it('fails when the browser contributed nothing', async () => {
    writeServerProfile(project, { first: 1, second: 0 });

    await expect(run()).rejects.toThrow(/browser/i);
  });

  // @scenario coverage-reporting/A report covering no source file fails the run
  it('fails when profiles hold data but none of it is ours', async () => {
    const map = {
      version: 3,
      file: 'bundle.js',
      sources: ['../elsewhere/other.ts'],
      sourcesContent: [SOURCE],
      names: [],
      mappings: identityMappings(SOURCE.split('\n').length),
    };
    fs.mkdirSync(path.join(project.root, 'elsewhere'));
    fs.writeFileSync(path.join(project.root, 'elsewhere', 'other.ts'), SOURCE);
    fs.writeFileSync(
      path.join(project.root, 'dist', 'bundle.js.map'),
      JSON.stringify(map),
    );
    writeServerProfile(project, { first: 1, second: 0 });
    writeBrowserProfile(project, { first: 0, second: 1 });

    await expect(run()).rejects.toThrow(/no project source/i);
  });
});
