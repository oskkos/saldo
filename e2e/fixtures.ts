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

/**
 * Attach each script's source map to its coverage entry.
 *
 * Client bundles reference their map by URL, so resolving one means an HTTP request
 * to the app — and the report runs after Playwright has killed the server, when
 * that request can only fail. Fetching here, while the server is still up, keeps
 * the report a pure offline transform. Without this the paths degrade to the chunk
 * URLs and the run fails the resolves-on-disk check.
 */
async function withSourceMaps(
  page: Page,
  entries: { url: string; source?: string }[],
) {
  return Promise.all(
    entries.map(async (entry) => {
      const reference = /\/\/# sourceMappingURL=(\S+)/.exec(entry.source ?? '');
      if (!reference) {
        return entry;
      }

      try {
        const response = await page.request.get(
          new URL(reference[1], entry.url).href,
        );
        return response.ok()
          ? { ...entry, sourceMap: await response.json() }
          : entry;
      } catch {
        // A map that cannot be fetched leaves the entry as it was; the report's
        // path check is what turns that into a failure, rather than this guessing.
        return entry;
      }
    }),
  );
}

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
    const entries = await withSourceMaps(
      page,
      (await page.coverage.stopJSCoverage()).filter((entry) =>
        isAppBundle(entry.url),
      ),
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
