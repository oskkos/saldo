import { describe, expect, it } from '@jest/globals';

import {
  FIXTURE_MODULE,
  findUninstrumentedTestFiles,
} from '../e2e-coverage-report.mjs';

// The browser half of coverage collection hangs off a fixture, so a spec file that
// takes `test` straight from the runner is not collected — and nothing about it
// looks wrong. This guard is the only thing standing between that and a silently
// shrinking report.

describe('fixture guard', () => {
  // @scenario coverage-reporting/A test file bypassing the instrumented fixture is rejected
  it('reports a file that takes test from the runner', () => {
    const entries = [
      {
        file: 'e2e/worklog.spec.ts',
        content: "import { test, expect } from '@playwright/test';\n",
      },
    ];

    expect(findUninstrumentedTestFiles(entries)).toEqual([
      'e2e/worklog.spec.ts',
    ]);
  });

  // @scenario coverage-reporting/A test file bypassing the instrumented fixture is rejected
  it('accepts a file that takes test from the fixture', () => {
    const entries = [
      {
        file: 'e2e/worklog.spec.ts',
        content: "import { test, expect } from './fixtures';\n",
      },
    ];

    expect(findUninstrumentedTestFiles(entries)).toEqual([]);
  });

  // @scenario coverage-reporting/A test file bypassing the instrumented fixture is rejected
  it('reports an aliased test import, which Playwright setup files use', () => {
    const entries = [
      {
        file: 'e2e/auth.setup.ts',
        content: "import { test as setup } from '@playwright/test';\n",
      },
    ];

    expect(findUninstrumentedTestFiles(entries)).toEqual(['e2e/auth.setup.ts']);
  });

  it('ignores helpers that import only types or expect from the runner', () => {
    const entries = [
      {
        file: 'e2e/ui.ts',
        content: "import { type Page } from '@playwright/test';\n",
      },
      {
        file: 'e2e/db.ts',
        content: "import { expect } from '@playwright/test';\n",
      },
    ];

    expect(findUninstrumentedTestFiles(entries)).toEqual([]);
  });

  it('ignores the fixture module itself, which has to extend the runner', () => {
    const entries = [
      {
        file: FIXTURE_MODULE,
        content: "import { test as base } from '@playwright/test';\n",
      },
    ];

    expect(findUninstrumentedTestFiles(entries)).toEqual([]);
  });

  it('spans a multi-line import block', () => {
    const entries = [
      {
        file: 'e2e/saldo.spec.ts',
        content:
          "import {\n  test,\n  expect,\n  type Page,\n} from '@playwright/test';\n",
      },
    ];

    expect(findUninstrumentedTestFiles(entries)).toEqual(['e2e/saldo.spec.ts']);
  });
});
