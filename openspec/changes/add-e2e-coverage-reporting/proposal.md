## Why

Codecov only sees Jest. A fresh `npm run test:ci` reports **51.1% of statements
(856/1676), with 61 of 101 files at exactly 0%** — and that dark set is not a backlog.
It is the browser surface:

```
                        Jest today            what Playwright drives
  src/services      ███████████████ 95%      ·
  src/repository    ███████████████ 96%      (same files, for real)
  src/util          ██████████████· 92%      ·
  ──────────────────────────────────────────────────────────────────
  src/app/**/page   ·············· 0%        ███████████ every suite
  src/components/*  ··············29%        ███████████ every page
  clock/**          ··············3.5%       ███████████ time-clock.spec
  worklogItem/**    ··············9.9%       ███████████ worklog.spec
```

Every `page.tsx`, the clock card and clock-out modal, the worklog item/edit/delete
components, navbar, dock, quick-add, saldo badge — all sit at zero, and all are driven
on every CI run by seven Playwright suites whose per-requirement coverage CI already
enforces. The two layers are near-perfect complements, and the published number
counts one of them.

So the badge is not reporting "half the app is untested". It is reporting "half the
app is tested by a layer Codecov cannot see", and a reader has no way to tell those
apart. Worse, the gap argues against the layer this project has invested in: a new
server component lands at 0% and the coverage check nudges toward a mock-heavy jsdom
test, when a browser test already exercises it for real.

## What Changes

- Collect V8 coverage from **both runtimes the e2e suite drives**: the Next server
  process (`NODE_V8_COVERAGE`, flushed explicitly on shutdown) and Chromium
  (`page.coverage` via a shared Playwright fixture). Server-side is not optional here —
  pages are async server components and every mutation is a server action, so
  browser-only collection would miss most of what the e2e suite uniquely proves.
- Convert both profiles into one repo-relative lcov with
  **`monocart-coverage-reports`**, filtered to the same source set Jest uses
  (`src/**`, minus the generated Prisma client).
- **Opt in behind `E2E_COVERAGE`.** Source maps, the server profile and the browser
  collector all switch on together; a plain `npm run test:e2e` stays exactly as fast as
  today and writes nothing.
- **Fail loudly on an empty or partial report.** Collection depends on process-shutdown
  behaviour, so its characteristic failure is silent: publish nothing, and Codecov
  carries the previous report forward forever. The report step exits non-zero when
  either runtime contributed no data, when no source file survives filtering, or when
  any path in the lcov does not resolve on disk.
- **Publish per layer**: Jest under flag `unit`, e2e under flag `e2e`, with a
  `codecov.yml` that carries each forward so a job that did not run cannot zero out the
  combined report.
- Add a `coverage-reporting` capability spec covering the above, with Jest tests over
  fixture V8 profiles for the conversion and the guards.

## Capabilities

### New Capabilities

- `coverage-reporting`: how line coverage is measured in each test layer, normalised,
  guarded against silent emptiness, and published per layer.

### Modified Capabilities

None. This measures the existing layers; it changes no application behaviour and adds
no requirement to any product capability.

## Impact

- **New**: `e2e/fixtures.ts` (coverage-collecting `page` fixture),
  `scripts/e2e-coverage-report.mjs` (+ its Jest tests and V8 fixtures), `codecov.yml`,
  `openspec/specs/coverage-reporting/spec.md`.
- **Modified**: `next.config.js` (source maps under the switch),
  `src/instrumentation.ts` (V8 flush on `SIGTERM`/`SIGINT`), `playwright.config.ts`
  (`NODE_V8_COVERAGE` in the server env, artifact cleanup in global setup), the seven
  `e2e/*.spec.ts` files and `auth.setup.ts` (import `test` from `./fixtures`),
  `.github/workflows/build.yml` (flags, report and upload steps),
  `package.json`, `.gitignore`, `CLAUDE.md`, `e2e/README.md`.
- **Dependencies**: one devDependency, `monocart-coverage-reports`. The
  `spec-test-traceability` script's "no dependencies" property is unaffected — that is
  a separate tool and stays dependency-free.
- **CI cost**: an extra build with source maps and V8 collection overhead in the e2e
  job, plus one upload step. Single-digit minutes at most; the suite is unchanged.
- **The published total will jump**, plausibly to somewhere near 80%. That is the
  point, but it is also a one-way ratchet: `target: auto` then holds the new floor on a
  flag that is structurally more fragile than Jest's. `codecov.yml` carries a threshold
  so a legitimate small dip does not fire, and the empty-report guard turns total
  collapse into a red build rather than a slow drift.
- **Risk — the coverage number gets weaker as a quality signal even as it gets more
  accurate.** V8 measures execution, not assertion: `navbar.tsx` renders on every page
  and goes green without any test asserting anything about it. This change does not ask
  coverage to answer "is it asserted" — `spec-test-traceability` already answers that,
  and better. Coverage's job here is reachability.
- **Resolved before building on it.** Whether Turbopack's `experimental.serverSourceMaps`
  yields maps that resolve back to `src/**` was the one unproven link. The spike settled
  it: they do, so the e2e build stays the bundler that ships. It also corrected two
  assumptions — `SIGTERM` already flushes the V8 profile unaided, and `src/proxy.ts` *is*
  covered, because `next start` runs the Edge runtime in-process. See `design.md`,
  Spike Outcome.
- **Unchanged**: the e2e suite itself. No test assertions change; the specs only
  re-point their `test` import.
