import fs from 'node:fs';
import path from 'node:path';
import { test as base, expect, type Page } from '@playwright/test';

import { COLLECT_COVERAGE, COVERAGE_DIRS } from './constants';

// Every spec takes its `test` from here rather than from '@playwright/test', so the
// browser half of coverage is collected without each file having to remember to.
// A spec that imports the runner directly is not collected and nothing looks wrong,
// which is why findUninstrumentedTestFiles() in scripts/e2e-coverage-report.mjs
// fails the build on one.

let profileIndex = 0;

/** Keep the app's own bundles; drop inline page scripts and anything third-party. */
const isAppBundle = (url: string) => url.includes('/_next/');

export const test = base.extend({
  // Playwright calls the second argument `use`; it is named runTest here because
  // react-hooks/rules-of-hooks reads a `use(...)` call inside a function named
  // `page` as React's use() hook and fails the lint.
  page: async ({ page, browserName }, runTest, testInfo) => {
    // page.coverage is Chromium-only. Both projects run Chromium today, but a
    // second browser should degrade to "no coverage from that project" rather
    // than failing every test in it.
    if (!COLLECT_COVERAGE || browserName !== 'chromium') {
      await runTest(page);
      return;
    }

    await page.coverage.startJSCoverage({ resetOnNavigation: false });
    await runTest(page);
    const entries = (await page.coverage.stopJSCoverage()).filter((entry) =>
      isAppBundle(entry.url),
    );

    // One file per test. Retries write their own, and coverage is a union, so a
    // retried test contributing twice is harmless.
    const name = `${process.pid}-${profileIndex++}.json`;
    fs.mkdirSync(COVERAGE_DIRS.browser, { recursive: true });
    fs.writeFileSync(
      path.join(COVERAGE_DIRS.browser, name),
      JSON.stringify({ testTitle: testInfo.titlePath.join(' > '), entries }),
    );
  },
});

export { expect, type Page };
