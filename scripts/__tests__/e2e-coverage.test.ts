import { afterEach, describe, expect, it, jest } from '@jest/globals';

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
