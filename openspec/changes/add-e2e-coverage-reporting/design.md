## Context

Coverage is published from one of two test layers. Measuring what that leaves out:

```
  statements   856 / 1676   51.1%
  files        101 total, 61 at exactly 0%
```

The 61 are the browser surface — every `src/app/**/page.tsx`, the clock components, the
worklog item/edit/delete components, navbar, dock, quick-add, saldo badge, theme
switcher — driven on every CI run by seven Playwright suites. Jest holds the pure and
server layers (`services` 95%, `repository` 96%, `util` 92%); Playwright holds almost
exactly the complement.

A second reading of the same data, cross-referenced against
`scripts/spec-coverage.exemptions.json`, is what shapes this design: the files that will
*stay* dark after this change are already documented as deliberate.

```
  src/app/(login)/signup/**          ┐
  src/app/(login)/forgot-password/** ├─ 10 files   auth/Sign-up ............ harness-cost
  src/app/(login)/reset-password/**  ┘             auth/Forgot-password .... external-dependency
                                                   auth/Reset password ..... harness-cost
  src/app/error.tsx                                no requirement drives an error boundary
  src/app/manifest.ts                              nothing fetches the webmanifest
  src/types/next-auth.d.ts    (2 stmts)  ┐         type-only — noise in both numbers
  src/util/index.ts           (2 stmts)  ┘         barrel re-export
  src/proxy.ts                                     Edge runtime — see Risks
```

Two records of the same truth, written independently, agreeing. That raises confidence
that the mechanism is measuring what it claims to.

Constraints discovered in the stack:

- **Next 16.2.6 builds with Turbopack by default.** `--webpack` is still accepted.
  `serverSourceMaps` is referenced only from `webpack-config.js` on the JavaScript side,
  but appears as a string inside `next-swc.linux-x64-gnu.node`, so Turbopack's Rust side
  knows the option. Whether it emits maps that resolve is unestablished.
- **Sentry's config sets `hideSourceMaps: true`**, which strips `sourceMappingURL` from
  client bundles — so the browser cannot find its own maps.
- **Jest writes repo-relative lcov paths** (`SF:src/instrumentation.ts`). Codecov merges
  per file by string equality, so a bundler-prefixed path does not merge; it grows a
  parallel ghost tree.
- **`src/instrumentation.ts` already exists** (Sentry init), so the server needs no new
  entry point to hang a shutdown hook on.
- **`NODE_V8_COVERAGE` writes at normal exit only.** Default signal death skips the
  exit path, and Playwright terminates the web server by signal.
- **Playwright kills the web server during its own shutdown**, after global teardown.
  Nothing inside Playwright's lifecycle can observe the server's profile.
- **`page.coverage` is Chromium-only and per-page**, so collection has to hang off a
  fixture rather than a reporter.
- **The two CI jobs run in parallel** (`build-and-test`, `e2e`) and share no artifacts.
- **The e2e suite is serial** (`workers: 1`), so there is no cross-worker merge to solve.
- The `spec-test-traceability` scanner reads `import { … } from '<anything>'`, so
  re-pointing the specs' `test` import breaks no annotation.

## Spike Outcome

Run before anything was built on it, against a real `E2E_COVERAGE=1` production build
(Turbopack) serving on port 3100. **Outcome 1: Turbopack's maps resolve. No `--webpack`
fallback is needed.** Server-side V8 coverage resolved to real repo-relative paths
including `src/app/(calendar)/page.tsx`, `src/actions/index.ts`, `src/auth/authSession.ts`
and the whole `repository`/`services`/`util` set; the browser profile resolved 31 files
including `credentialsSignin.tsx`, `themeSwitcher.tsx` and the form inputs.

Five findings changed the design:

1. **The two runtimes name sources differently.** Server ssr chunk maps are *sectioned*
   (indexed) maps — the top-level `sources` array is empty and the real paths live in
   `sections[].map.sources` as paths relative to the map, which monocart resolves to
   `src/…` on its own. Client chunk maps are prefixed: `turbopack:///[project]/src/…`.
   Normalisation has to strip `[project]/` and leave the already-relative form alone.
   A first pass that only read top-level `sources` concluded the maps were empty.

2. **Next ships source maps referencing its own `src/` tree.** A `startsWith('src/')`
   filter silently pulled in `src/server/lib/utils.ts`, `src/cli/next-test.ts` and the
   rest of Next's internals. Resolving against the repo root and requiring the file to
   exist is what separates ours from theirs — the same on-disk check the spec already
   requires for a different reason, which is a good sign it belongs there.

3. **`sourceFilter` does not govern unmapped scripts.** Anything without a source map
   arrives as an entry and needs `entryFilter`. Unrelated Node processes inheriting
   `NODE_V8_COVERAGE` — the `npx` wrapper, in the spike — wrote profiles into the same
   directory and put 740 files of npm's own source into the lcov.

4. **`SIGTERM` already flushes.** `next start` exits gracefully and Node writes the
   profile on the way out; a `coverage-<pid>-*.json` appeared without any hook. The
   explicit `v8.takeCoverage()` in `instrumentation.ts` is therefore defence-in-depth
   against a future change in Next's signal handling, not the load-bearing mechanism it
   was designed as. Kept, because the alternative is discovering the regression as a red
   build during an upgrade.

5. **`src/proxy.ts` is covered after all.** The prediction that middleware would be
   structurally uncoverable was wrong: `next start` runs the Edge runtime in-process, and
   V8 sees it. The proposal's "known limitation" is withdrawn.

## Goals / Non-Goals

**Goals:**

- Publish what the browser layer executes, in the layers it uniquely reaches: server
  components, server actions end-to-end, and client components.
- Make the published figure mean "reachable code this project executes under test",
  across both layers, rather than "code Jest executes".
- Make the mechanism's silent failure mode impossible: no data must be a red build, not
  a quiet republish of yesterday's number.
- Keep the default `npm run test:e2e` untouched in speed and output.

**Non-Goals:**

- **Coverage as an assertion gate.** V8 records execution. `spec-test-traceability`
  already answers "is this asserted", with the explicit rule that a test may claim a
  scenario only if it asserts that scenario's THEN. Coverage is not asked to re-answer
  it, and a green file here is not evidence of an assertion.
- **A "covered by neither layer" report in CI.** It is the most interesting derived
  number, but the two jobs run in parallel and share no artifacts, so producing it would
  mean serialising them or shuttling lcov between them. Codecov's per-flag view answers
  the question already, and both layers can be run locally to get it.
- **A single merged upload.** Two flags keep the layers separable, which is the whole
  reason the number is worth fixing.
- **Source instrumentation.** See below.
- **Parallelising the e2e suite.**

## Decisions

### V8 coverage, not source instrumentation

Node and Chromium both already collect coverage; the work is converting two V8 profiles
into one source-mapped lcov. `monocart-coverage-reports` does exactly that, resolves
source maps for both runtimes, and emits `lcovonly`.

*Alternatives considered.* **Istanbul via `swc-plugin-coverage-instrument`** gives exact
mappings, because it instruments original source before bundling and never depends on a
source map. Rejected on two counts: the plugin is still `0.0.32` and untouched since
November 2025, and a WASM SWC plugin has to match the compiler's ABI — and it forces
`next build --webpack`, so the app the e2e suite drives would stop being the Turbopack
build that actually ships. Instrumenting for coverage is acceptable; changing bundler
for coverage is not. It also needs an env-gated route to drain the server's
`global.__coverage__`, which is app surface added for tests.

**Hand-rolled V8 conversion** — `c8` for the server profile, `v8-to-istanbul` plus
`istanbul-lib-coverage` for the browser — was the close call. It trades one dependency
for roughly 150 lines of source-map resolution, path rewriting and merge logic that
monocart already solves and tests. Rejected for that reason alone; if monocart proves
wrong, this is the fallback.

### The server flushes its own profile

`NODE_V8_COVERAGE=…` on the web server env is not sufficient: Node writes the profile on
the normal exit path, and Playwright ends the server with a signal, which skips it. The
existing `src/instrumentation.ts` `register()` gains an env-gated hook that installs
`SIGTERM`/`SIGINT` handlers calling `v8.takeCoverage()` before exiting zero.
`takeCoverage()` is synchronous, so the write completes before the process goes away.

*Alternatives considered.* An **env-gated route** that drains coverage on request, hit
from global teardown, removes all dependence on shutdown behaviour — but it adds a
route to the application whose only purpose is testing, and a gate that fails open would
expose it. A **`globalTeardown` that signals the server itself** does not help: the
process is Playwright's to manage, and the same flush problem applies.

*Consequence.* This is the fragile part. A Next upgrade that changes signal handling
breaks collection, which is precisely why the guard below exists.

*Implementation trap.* `instrumentation.ts` is compiled for the Edge runtime as well,
where `process.on` and `process.exit` do not exist. The runtime check therefore has to
be a positive condition **wrapping** the Node calls rather than an early return:
Turbopack inlines `NEXT_RUNTIME`, so the wrapped form is dead code in the Edge build and
gets dropped, while a guard clause leaves the calls reachable and the build warns on
each one. Verified both ways — `takeCoverage` is present in the Node chunk and absent
from the Edge chunk.

### The report is generated after the run, as its own step

The server's profile does not exist until Playwright kills it, which happens during
Playwright's shutdown — after global teardown. So conversion cannot be a reporter or a
teardown hook; it runs as a separate command after `playwright test` exits.

In CI that is two steps, and a failing suite therefore uploads nothing. That is correct:
a failed run's coverage is not a fact worth publishing.

### Browser collection hangs off a shared fixture

`e2e/fixtures.ts` extends `test` with a `page` fixture that starts
`page.coverage.startJSCoverage({ resetOnNavigation: false })`, yields, then writes the
stopped profile to a per-test file. The eight spec files and `auth.setup.ts` import
`test` from there instead of `@playwright/test`. When the switch is off the fixture
yields the page untouched.

**`auth.setup.ts` is included deliberately.** It drives the real credentials sign-in form
on every run, so excluding it would leave `signin/page.tsx` and `credentialsSignin.tsx`
dark in a report whose whole claim is that it records what the suite executes.

*This makes coverage and requirement-level traceability disagree*, and the disagreement
is correct rather than a defect to reconcile. `auth/Email/password sign-in` is covered
end to end, while the neighbouring auth requirements carry `harness-cost` and
`external-dependency` exemptions — and the sign-in *page* will nonetheless show as
executed, because it is. One record measures whether a requirement's journey is
asserted; the other measures which lines ran. Reading either as the other is the mistake
to avoid, not the overlap.

### One switch turns on everything

`E2E_COVERAGE` gates the source maps in `next.config.js`, `NODE_V8_COVERAGE` in the
Playwright server env, the browser fixture, and artifact cleanup in global setup.
`npm run test:e2e:coverage` sets it; CI uses that.

Under the switch, `next.config.js` also sets `hideSourceMaps: false`, without which the
client bundles carry no `sourceMappingURL` and the browser profile cannot be mapped
back. The shipped build is unchanged: the switch is never set outside e2e, and the only
difference it makes is emitting and exposing source maps — no code transform.

*Alternatives considered.* **Always on** removes the risk of CI silently collecting
nothing because a flag was dropped. Rejected because it makes every local e2e run
rebuild with source maps, pay the V8 overhead and litter the working tree — and the
guard already turns "collected nothing" into a hard failure, which is the same
protection without the cost.

### Paths are repo-relative and checked against the filesystem

Bundler source maps name sources like `turbopack:///[project]/src/app/settings/page.tsx`
or `webpack://_N_E/./src/…`. Every path in the generated lcov is normalised to
repo-relative (`src/app/settings/page.tsx`) to match Jest's format exactly, and the
report step then asserts each one resolves to a file on disk.

Without that assertion the failure is invisible in the worst way: the lcov is
well-formed, the upload succeeds, Codecov renders a second file tree beside the real
one, and per-file merging silently does nothing.

### An empty or partial report fails the build

The report step exits non-zero when the server profile directory is missing or empty,
when no browser profile was written, when no source file survives filtering, or when any
`SF:` path does not resolve. Total collapse becomes a red build.

*What this does not catch* is partial degradation — collection that still works but
covers less than it did. That surfaces as a coverage drop on the `e2e` flag instead,
which is a confusing thing to debug but the right alarm to have.

### Scope matches the unit layer exactly

The e2e report includes `src/**` and excludes the generated Prisma client, mirroring
Jest's `collectCoverageFrom`. Two reports over different source sets cannot be compared,
and Codecov would merge them into a set that is neither.

### Two flags, each carried forward

Jest uploads as `unit`, e2e as `e2e`, from their own jobs. `codecov.yml` sets
`carryforward: true` on both, so a job that did not run reuses its last known report
rather than reporting zero, and a threshold so a legitimate small dip does not fail a
pull request.

## Risks / Trade-offs

- ~~**Turbopack server source maps are unproven.**~~ Settled by the spike: they resolve,
  and the e2e build stays the bundler that ships. See Spike Outcome.
- **The published total jumps and then ratchets.** → Expected, and the reason for the
  threshold. Worth stating plainly: the new floor is held up partly by execution
  coverage nobody asserts.
- **Execution is not assertion.** → Stated as a non-goal, documented in
  `e2e/README.md`, and left to `spec-test-traceability`, which measures it properly.
- **The shutdown flush is the fragile link.** → Less fragile than assumed — `SIGTERM`
  flushes unaided — but still guarded by the empty-report check, with degradation showing
  as a flag-level drop.
- ~~**Sentry may delete source maps after upload.**~~ Checked in the spike: with no
  `SENTRY_AUTH_TOKEN` the upload is skipped and all 112 server maps plus 27 client maps
  survive the build.
- **One new devDependency.** → `monocart-coverage-reports`, dev-only, and the
  hand-rolled fallback stays viable if it goes unmaintained.

## Migration Plan

The same ordering problem as `add-e2e-requirement-coverage`, with the same answer: the
`coverage-reporting` requirements only become canonical at archive, but
`spec:coverage:ci` checks canonical specs. So `/opsx:sync` runs as an implementation
step, before the branch tip has to be green, and the archive is then just the folder
move.

Order within the change is set by the spike: prove server-side maps resolve before
building anything on top of them. Browser collection is independent and could land
first, but doing so would bank the easy half of a mechanism whose hard half might not
work.

The new capability's own requirements need end-to-end decisions, and all of them are
`no-ui` — this is a CI script with no user-visible surface, exactly like
`spec-test-traceability`.

Rollback is small and self-contained: drop the two CI steps and `codecov.yml`, and the
existing single unflagged upload behaves as it does today. Nothing in the application
depends on any of this; the `E2E_COVERAGE` branches are inert when unset.
