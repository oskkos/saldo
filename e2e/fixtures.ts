import { createHash } from 'node:crypto';
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

/** Chunk URLs whose source and map are already on disk, so each is stored once. */
const storedScripts = new Set<string>();

/** Keep the app's own bundles; drop inline page scripts and anything third-party. */
const isAppBundle = (url: string) => url.includes('/_next/');

const scriptFile = (url: string) =>
  path.join(
    COVERAGE_DIRS.browserScripts,
    `${createHash('sha1').update(url).digest('hex').slice(0, 16)}.json`,
  );

/**
 * Store one chunk's source and source map, once per run.
 *
 * Both are identical across every test that loads the chunk, so per-test copies are
 * pure duplication — 734 MB of it for a 44-test run before this. The map also has to
 * be fetched here rather than at report time: client bundles reference it by URL, and
 * by then Playwright has killed the server.
 */
async function storeScript(
  page: Page,
  entry: { url: string; source?: string },
): Promise<void> {
  if (storedScripts.has(entry.url)) {
    return;
  }

  const file = scriptFile(entry.url);
  // Another worker may have written it already — the content is the same either way.
  if (fs.existsSync(file)) {
    storedScripts.add(entry.url);
    return;
  }

  const reference = /\/\/# sourceMappingURL=(\S+)/.exec(entry.source ?? '');
  let sourceMap: unknown;
  if (reference) {
    try {
      const response = await page.request.get(
        new URL(reference[1], entry.url).href,
      );
      if (response.ok()) {
        sourceMap = await response.json();
      }
    } catch {
      // A map that cannot be fetched leaves the script unmapped. The report's own
      // checks are what turn that into a failure, rather than this guessing.
    }
  }

  // Written via a temporary name so a reader never sees half a file.
  const temporary = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(
    temporary,
    JSON.stringify({ url: entry.url, source: entry.source, sourceMap }),
  );
  fs.renameSync(temporary, file);
  storedScripts.add(entry.url);
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
    const covered = (await page.coverage.stopJSCoverage()).filter((entry) =>
      isAppBundle(entry.url),
    );

    for (const entry of covered) {
      await storeScript(page, entry);
    }

    // Only the execution counts vary per test; source and map live in the script
    // store, and the report joins them back together.
    const name = `${process.pid}-${profileIndex++}.json`;
    fs.mkdirSync(COVERAGE_DIRS.browser, { recursive: true });
    fs.writeFileSync(
      path.join(COVERAGE_DIRS.browser, name),
      JSON.stringify({
        testTitle: testInfo.titlePath.join(' > '),
        entries: covered.map(({ url, functions }) => ({ url, functions })),
      }),
    );
  },
});

export { expect, type Page };
