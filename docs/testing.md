# Testing

Two layers, deliberately covering different halves of the codebase.

| Layer          | Runner                    | Lives in            | Covers                                                    |
| -------------- | ------------------------- | ------------------- | ---------------------------------------------------------- |
| Unit / server  | Jest (jsdom)              | `src/**/__tests__/` | `services`, `repository`, `util`, `schemas`, `actions`      |
| End-to-end     | Playwright                | `e2e/`              | Every `page.tsx` and component, driven in a real browser    |

`npm run test:ci` runs Jest only — `e2e/` is excluded from it. The two report to
Codecov under separate flags for the same reason they exist separately: neither one
describes the codebase alone.

## Running them

```bash
npm run test:ci                                  # Jest, once, with coverage
npm test                                         # Jest in WATCH mode — does not exit
npx jest src/services/__tests__/someFile.test.ts # a single file
npx jest src/services -t "computes the balance"  # filter by test name
```

The Playwright suite needs a one-time setup, then runs on its own:

```bash
docker compose up -d db
docker compose exec -T db psql -U postgres -c "CREATE DATABASE saldo_test"  # once
cp .env.e2e.example .env.e2e                                                # once
npm run test:e2e                                 # migrations + seed + tests
npm run test:e2e:ui                              # watch and debug
```

It boots the app on **port 3100** against `saldo_test`, so it never collides with a
dev server on 3000 and never touches your dev data. [`e2e/README.md`](../e2e/README.md)
documents the harness — the fixtures, the shared locators, the seeding helpers, and
the rules for writing a test that survives being run on an arbitrary date.

## What belongs where

Put a rule where it can be pinned most precisely. The saldo calculation has dozens of
edge cases around holidays, partial days and absence reasons; those belong in Jest,
where each is three lines. Whether the badge actually updates after you save a worklog
is a question about wiring, and only a browser can answer it.

In practice:

- **Jest** — anything in `services` (pure, so exhaustive cases are cheap), repository
  behaviour with Prisma and the session mocked, Zod schema validation, date helpers.
- **Playwright** — the user-visible journey for each capability, and anything whose
  failure mode is "the pieces don't talk to each other".

One asymmetry worth knowing: **a test asserting a message the server produced must be
run against a production build.** Locally the harness starts `next dev`; CI starts
`npm run start`. A production build replaces the message of anything *thrown* out of a
server action with an opaque digest, so a toast that reads fine in dev can be empty in
CI. Check it the way CI will:

```bash
npm run build && CI=1 npm run test:e2e
```

## Coverage

Both layers report line coverage to Codecov, Jest under the `unit` flag and Playwright
under `e2e`. They cover near-complementary halves, so only the pair describes the
whole; both are set to `carryforward` in `codecov.yml` so a layer that did not run is
never read as a layer that covers nothing.

E2E coverage is off by default:

```bash
npm run test:e2e:coverage    # E2E_COVERAGE=1
npm run coverage:e2e:report  # → coverage-e2e/{server,browser}/lcov.info
```

One switch drives all three moving parts — source maps in the build, `NODE_V8_COVERAGE`
on the app server, and the `page.coverage` collector in `e2e/fixtures.ts`. A plain
`npm run test:e2e` is unaffected and writes nothing.

Two properties of this setup are deliberate and worth not undoing:

- **One report per runtime, both uploaded under `e2e`.** They are not merged locally.
  The converter resolves both runtimes to the same source path but does not union
  their execution counts, so merging would let the server's zero mask a browser hit
  for every file both touch. Codecov unions uploads within a flag, which is where the
  merge correctly happens.
- **The report step fails loudly** when a runtime contributed nothing, when no project
  source survives filtering, or when a path does not resolve on disk. Silent-empty is
  this mechanism's characteristic failure: Codecov would carry the previous report
  forward and the number would stay plausible while ceasing to be true.

**Every spec takes `test` from `e2e/fixtures.ts`**, not from `@playwright/test` — that
import is what starts the browser profiler. A file that imports the runner directly is
silently left out of coverage and nothing about it looks wrong, so
`scripts/__tests__/e2e-coverage.test.ts` scans the directory and fails the build on
one. Importing `expect` or `type Page` from the runner is fine.

**Execution is not assertion.** A file is green here because it ran, not because
anything checked what it did — `navbar.tsx` renders on every page. What a test
actually proves is recorded by the annotations below.

## Spec-to-test traceability

CI enforces two rules from the same annotations:

1. Every **scenario** in `openspec/specs/` is covered by a test, or explicitly exempt.
2. Every **requirement** has at least one scenario covered by a **Playwright** test, or
   carries a categorised end-to-end exemption.

```bash
npm run spec:coverage      # regenerate openspec/COVERAGE.md (commit the result)
npm run spec:coverage:ci   # what CI runs: --check --strict, writes nothing
```

### Declaring coverage

Put the claim directly above the test, in either layer:

```ts
// @scenario time-clock/Clock in when idle
it('records the session start', () => { ... })
```

Stack the comments to claim several scenarios. On a `describe` or `test.describe` the
claim applies to every test inside. Many-to-many is fine — one test may cover several
scenarios, and several tests may jointly cover one. The layer is read from the test's
path (`e2e/**`); there is no extra syntax for it.

**A test may claim a scenario only if it asserts that scenario's THEN.** No tool can
catch an over-claim — this is a review check, and it is the one that decides whether
the coverage map means anything. If a scenario's THEN spans layers ("throws a
validation error **and** nothing is written"), a schema test alone does not cover it:
assert the persistence half at the action level too, or let two tests jointly cover it.

Regenerate and commit `openspec/COVERAGE.md` whenever annotations or specs change; CI
fails on a stale map. Renaming a scenario deliberately breaks every annotation citing
it — that is the signal to re-read those tests, not an inconvenience to route around.

### Exemptions

Something genuinely untestable gets an entry under `scenarios` in
`scripts/spec-coverage.exemptions.json`, with a reason in your own words (a
`<capability>/*` wildcard is allowed).

A requirement with no Playwright test needs an entry under `requirementsWithoutE2e`
carrying one of four categories:

| Category              | Means                                                             |
| --------------------- | ----------------------------------------------------------------- |
| `no-ui`               | The requirement has no user-visible surface at all.               |
| `unit-appropriate`    | Observable, but pinned more precisely at a lower layer.           |
| `external-dependency` | Needs a third party the test environment cannot drive.            |
| `harness-cost`        | Declined deliberately: the setup outweighs the confidence gained. |

`harness-cost` also requires `coveredAt`, naming a test file that does cover the
requirement, and that file must exist. It is the only category asserting a judgement
rather than a fact, so the claim is made checkable rather than left unfalsifiable.

Exemptions cannot rot quietly: one naming an unknown scenario or requirement fails the
run, and so does one for something a test has since started covering — coverage
arriving later forces the exemption out rather than letting it hide.

**One known gap.** The tool counts annotations, not results. A `test.fixme` or
`test.skip` carrying `@scenario` lines reports coverage that never runs. Delete a test
you cannot make pass, or exempt its requirement honestly — do not leave it skipped with
its annotations attached.
