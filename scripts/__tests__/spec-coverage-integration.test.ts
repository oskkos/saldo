import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from '@jest/globals';

// These assert the tool's contract with the repository around it — how it is
// wired into CI and what it is allowed to depend on — rather than its parsing.
const repoRoot = path.join(__dirname, '..', '..');
const read = (relative: string) =>
  fs.readFileSync(path.join(repoRoot, relative), 'utf8');

describe('coverage tooling dependencies', () => {
  // @scenario spec-test-traceability/Tool runs without installing anything new
  it('imports only Node standard-library modules', () => {
    const source = read('scripts/spec-coverage.mjs');
    const imports = [...source.matchAll(/^import .* from '([^']+)';$/gm)].map(
      (match) => match[1],
    );

    expect(imports.length).toBeGreaterThan(0);
    for (const specifier of imports) {
      expect(specifier.startsWith('node:')).toBe(true);
    }
  });

  // @scenario spec-test-traceability/Tool runs without installing anything new
  it('is invoked straight through node, with no build step', () => {
    const scripts = JSON.parse(read('package.json')).scripts as Record<
      string,
      string
    >;

    expect(scripts['spec:coverage']).toBe('node scripts/spec-coverage.mjs');
    expect(scripts['spec:coverage:ci']).toBe(
      'node scripts/spec-coverage.mjs --check --strict',
    );
  });
});

describe('CI wiring', () => {
  // @scenario spec-test-traceability/Uncovered scenario fails CI
  it('runs the strict check as a step of the build-and-test job', () => {
    const workflow = read('.github/workflows/build.yml');
    const buildJob = workflow.slice(
      workflow.indexOf('  build-and-test:'),
      workflow.indexOf('  e2e:'),
    );

    expect(buildJob).toContain('npm run spec:coverage:ci');
  });

  // @scenario spec-test-traceability/Coverage step needs no database or browser
  it('runs in a job that starts no database and installs no browser', () => {
    const workflow = read('.github/workflows/build.yml');
    const buildJob = workflow.slice(
      workflow.indexOf('  build-and-test:'),
      workflow.indexOf('  e2e:'),
    );

    // The e2e job needs a postgres service and a chromium install; the job
    // hosting the coverage check must need neither.
    expect(buildJob).not.toContain('services:');
    expect(buildJob).not.toContain('playwright install');
  });
});

describe('traceability documentation', () => {
  // @scenario spec-test-traceability/Hand-maintained table replaced by a pointer
  it('points the e2e README at the generated map instead of restating it', () => {
    const readme = read('e2e/README.md');

    expect(readme).toContain('openspec/COVERAGE.md');
    // The old hand-maintained mapping table is gone: no markdown table rows
    // naming a requirement, scenario and test.
    expect(readme).not.toContain('| Requirement');
  });
});
