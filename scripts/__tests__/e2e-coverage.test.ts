import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it, jest } from '@jest/globals';

import { findUninstrumentedTestFiles } from '../e2e-coverage-report.mjs';

// The end-to-end coverage pipeline's contract with the repository around it: what
// the build emits, how the report is wired into CI, and which layer each upload
// claims to measure. The conversion itself is asserted in
// e2e-coverage-report.test.ts against fixture profiles.

type NextConfig = {
  productionBrowserSourceMaps?: boolean;
  experimental?: { serverSourceMaps?: boolean };
};

/**
 * Load `next.config.js` with the coverage switch in a known state.
 *
 * The config is read at module scope, so the module registry has to be reset
 * between loads — otherwise the second call returns the first call's object and
 * the assertion passes for the wrong reason.
 */
const loadNextConfig = (coverage: boolean): NextConfig => {
  jest.resetModules();
  if (coverage) {
    process.env.E2E_COVERAGE = '1';
  } else {
    delete process.env.E2E_COVERAGE;
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('../../next.config.js') as NextConfig;
};

const originalSwitch = process.env.E2E_COVERAGE;

afterEach(() => {
  if (originalSwitch === undefined) {
    delete process.env.E2E_COVERAGE;
  } else {
    process.env.E2E_COVERAGE = originalSwitch;
  }
});

const repoRoot = path.join(__dirname, '..', '..');

describe('every end-to-end test file is instrumented', () => {
  // @scenario coverage-reporting/A test file bypassing the instrumented fixture is rejected
  it('takes its test function from the fixture, not the runner', () => {
    const dir = path.join(repoRoot, 'e2e');
    const entries = fs
      .readdirSync(dir)
      .filter((name) => /\.tsx?$/.test(name))
      .map((name) => ({
        file: `e2e/${name}`,
        content: fs.readFileSync(path.join(dir, name), 'utf8'),
      }));

    expect(entries.length).toBeGreaterThan(0);
    expect(findUninstrumentedTestFiles(entries)).toEqual([]);
  });
});

describe('each layer is published under its own flag', () => {
  const workflow = () =>
    fs.readFileSync(
      path.join(repoRoot, '.github', 'workflows', 'build.yml'),
      'utf8',
    );

  /** The steps of one job, sliced out of the workflow by the next job's key. */
  const job = (name: 'build-and-test' | 'e2e') => {
    const text = workflow();
    const start = text.indexOf(`  ${name}:`);
    const nextJob = text.indexOf('\n  e2e:', start + 1);
    return text.slice(start, name === 'build-and-test' ? nextJob : undefined);
  };

  // @scenario coverage-reporting/Unit coverage is published under its own flag
  it('flags the unit upload as the unit layer', () => {
    const unitJob = job('build-and-test');

    expect(unitJob).toContain('codecov/codecov-action');
    expect(unitJob).toMatch(/flags:\s*unit/);
  });

  // @scenario coverage-reporting/End-to-end coverage is published under its own flag
  it('flags the end-to-end upload as the end-to-end layer, with both runtimes', () => {
    const e2eJob = job('e2e');

    expect(e2eJob).toMatch(/flags:\s*e2e/);
    // Both runtimes are uploaded under that one flag; the service unions them.
    expect(e2eJob).toContain('coverage-e2e/server/lcov.info');
    expect(e2eJob).toContain('coverage-e2e/browser/lcov.info');
  });

  // @scenario coverage-reporting/The end-to-end job reports before uploading
  it('generates the report after the suite and before the upload', () => {
    const e2eJob = job('e2e');
    const suite = e2eJob.indexOf('npm run test:e2e:coverage');
    const report = e2eJob.indexOf('npm run coverage:e2e:report');
    const upload = e2eJob.indexOf('codecov/codecov-action');

    expect(suite).toBeGreaterThan(-1);
    expect(report).toBeGreaterThan(suite);
    expect(upload).toBeGreaterThan(report);
  });

  // @scenario coverage-reporting/Only the named reports are uploaded
  it('sends only the named reports, not whatever else is in the tree', () => {
    // Naming `files` is not enough on its own: the uploader adds them to its own
    // search. Left on, the unit flag received scripts/spec-coverage.exemptions.json
    // and the e2e flag received four raw V8 profiles — 4 and 6 files uploaded where
    // 1 and 2 were intended, and CI stayed green throughout.
    for (const name of ['build-and-test', 'e2e'] as const) {
      expect(job(name)).toMatch(/disable_search:\s*true/);
    }
  });

  // @scenario coverage-reporting/A layer that did not run is carried forward
  it('carries each flag forward so a job that did not run reads as absent', () => {
    const config = fs.readFileSync(path.join(repoRoot, 'codecov.yml'), 'utf8');
    const flags = config.slice(config.indexOf('flags:'));

    for (const flag of ['unit', 'e2e']) {
      const section = flags.slice(flags.indexOf(`${flag}:`));
      expect(section).toMatch(/carryforward:\s*true/);
    }
  });
});

describe('collection is opt-in', () => {
  const scripts = () =>
    JSON.parse(
      fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'),
    ) as { scripts: Record<string, string> };

  // @scenario coverage-reporting/The default end-to-end script enables nothing
  it('leaves the switch unset in the default end-to-end script', () => {
    expect(scripts().scripts['test:e2e']).not.toContain('E2E_COVERAGE');
  });

  // @scenario coverage-reporting/A dedicated script enables collection
  it('sets the switch in the coverage script', () => {
    // One switch: the build reads it for source maps, playwright.config.ts for the
    // server profiler, and e2e/fixtures.ts for the browser collector.
    expect(scripts().scripts['test:e2e:coverage']).toContain('E2E_COVERAGE=1');
  });
});

describe('build configuration', () => {
  // @scenario coverage-reporting/Source maps are emitted only under the switch
  it('emits no additional source maps when the switch is unset', () => {
    const config = loadNextConfig(false);

    expect(config.productionBrowserSourceMaps).toBeUndefined();
    expect(config.experimental?.serverSourceMaps).toBeUndefined();
  });

  // @scenario coverage-reporting/Source maps are emitted only under the switch
  it('turns on server and browser source maps under the switch', () => {
    const config = loadNextConfig(true);

    expect(config.productionBrowserSourceMaps).toBe(true);
    expect(config.experimental?.serverSourceMaps).toBe(true);
  });
});
