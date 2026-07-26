## Why

The coverage gate added by `add-spec-test-traceability` is layer-agnostic on purpose:
a scenario counts as covered whether a unit test or a browser test asserts it. That
was right for scenario coverage, but it means the gate exerts no pressure at all
toward end-to-end tests — and the result shows. Of 86 requirements, **7 have any
Playwright coverage, and all 7 are `time-clock`**. Every other capability is proven
only against mocks.

So nothing today notices that the app's core loop — create a worklog, see the saldo
move — has never been exercised through a browser. "Write more e2e tests" is exactly
the kind of aspiration the hand-maintained traceability table used to be: real, and
invisible when it slips.

## What Changes

- Extend `spec-test-traceability` with **requirement-level** e2e enforcement: each
  requirement SHALL have at least one scenario covered by a test under `e2e/`, or an
  explicit e2e exemption. Requirement level, not scenario level, because demanding a
  browser test per scenario would force absurd tests for rules like "lunch break
  subtracted = 525 minutes".
- Record e2e exemptions under a second top-level key in
  `scripts/spec-coverage.exemptions.json`, each carrying an **enum category** plus
  prose: `no-ui`, `unit-appropriate`, `external-dependency`, `harness-cost`.
  `harness-cost` additionally requires a `coveredAt` pointer to the layer that does
  test the requirement — it is the only category that is a judgement rather than a
  fact, so its claim has to point at something checkable.
- **No new test annotation syntax.** The coverage layer is derived from the file path
  of the covering test, which the tool already records.
- Fix a correctness hole found while exploring: the annotation scanner only
  recognises `it` / `test` / `describe`, so the standard Playwright idiom
  `import { test as setup }` produces *silently uncoverable* tests. Teach the scanner
  to read aliased test imports. This makes `auth/Email/password sign-in` — already
  driven for real by `auth.setup.ts` on every run — honestly coverable.
- Add e2e suites covering **25 requirements**: `worklog` (8), `statistics` (6),
  `settings` (5), `absence` (4), `expected-hours` (2), with the `db.ts` seed and
  reset helpers they need.
- Write the **37 e2e exemptions** so every one of the 63 undecided requirements gets
  a deliberate answer, then switch the gate on in the same change.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `spec-test-traceability`: gains requirement-level e2e coverage as an enforced
  dimension, the categorised e2e exemption format, and the aliased-test-import rule
  for the scanner.

## Impact

- **Modified**: `scripts/spec-coverage.mjs` (requirement-level analysis, e2e
  exemptions, aliased imports), `scripts/spec-coverage.exemptions.json` (new
  top-level key), `openspec/COVERAGE.md` (regenerated, gains an e2e dimension),
  `e2e/db.ts` (seed/reset helpers), `e2e/auth.setup.ts` (annotation), `CLAUDE.md`,
  `e2e/README.md`.
- **New**: e2e suites for worklog, statistics, settings, absence and expected-hours;
  Jest tests for the new tool behaviour.
- **Unchanged**: `.github/workflows/build.yml` needs no new step — the existing
  `npm run spec:coverage:ci` picks the new rule up.
- **Dependencies**: none added.
- **CI cost**: e2e grows from 9 tests (~2 min) to roughly 40 (~8–10 min). Accepted;
  the suite stays serial (`workers: 1`) rather than spending this change's budget on
  per-worker isolation.
- **Risk — weaker assertions.** e2e tests must be date-agnostic: `page.clock` controls
  only the browser, while begin-date accrual, future-entry exclusion and working-day
  counting are decided on the server against the real date. Several statistics and
  settings tests will therefore assert relationships ("the badge drops by one
  expected day") rather than absolute values. The alternative — making the server
  clock injectable — bends production code for tests and was rejected.
- **Risk — 37 exemptions in one pass** is the rubber-stamping failure the previous
  change warned about. The enum makes them reviewable in bulk and `coveredAt` makes
  the weakest category checkable, but they still need a real read in review.
