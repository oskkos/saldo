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
