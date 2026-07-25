## Why

The specs in `openspec/specs/` describe 122 scenarios, but nothing connects them to
the test suite. The only link that exists — a hand-maintained table in
`e2e/README.md` covering time-clock — has to be updated by hand and drifts silently.
So today there is no way to answer two questions that matter on every PR: which
scenarios are actually tested, and did this PR add a scenario without a test.

## What Changes

- Add a `// @scenario <capability>/<Scenario title>` annotation convention that tests
  use to declare the scenarios they cover, in both test layers (Jest and Playwright).
- Add `scripts/spec-coverage.mjs`, which parses the specs and the annotations and
  generates a committed coverage map at `openspec/COVERAGE.md` — per-capability
  coverage counts, every scenario with a content hash and the tests covering it, and
  the list of uncovered scenarios.
- Add an exemption list (`scripts/spec-coverage.exemptions.json`) so scenarios that
  cannot be automated are recorded with a stated reason instead of counting as gaps
  or inviting fake tests.
- Wire the tool into CI (`npm run spec:coverage:ci` in the existing `build-and-test`
  job). It fails the build on an uncovered scenario, on an annotation citing a
  scenario that no longer exists, and on a coverage map that is out of date.
- Annotate the existing tests, then **write the missing tests** so every one of the
  122 scenarios ends up either covered or explicitly exempt — which is what allows
  the CI gate to be switched on within this same change rather than later.
- Replace the hand-maintained traceability table in `e2e/README.md` with a pointer to
  the generated map, leaving a single source of truth.

## Capabilities

### New Capabilities

- `spec-test-traceability`: how scenarios are linked to tests, what the generated
  coverage map contains, how exemptions are declared, and what CI enforces.

### Modified Capabilities

None. No existing requirement changes behaviour; the existing capabilities gain
tests and annotations, not new rules.

## Impact

- **New**: `scripts/spec-coverage.mjs`, `scripts/spec-coverage.exemptions.json`,
  `openspec/COVERAGE.md` (generated, committed), Jest tests for the script's parser.
- **Modified**: `package.json` (two scripts, no new dependencies),
  `.github/workflows/build.yml` (one step), `e2e/README.md`, `CLAUDE.md`, and every
  existing test file under `src/**/__tests__/` plus `e2e/time-clock.spec.ts` (comment
  annotations only, no behaviour change).
- **New tests**: the capabilities with no adjacent coverage today — `auth`,
  `statistics`, `data-load-performance` — plus the remaining gaps in `worklog`,
  `saldo`, `settings`, `absence` and `expected-hours`.
- **Dependencies**: none added. The script is plain ESM on Node 20, matching CI.
- **Risk**: the gate is only as honest as the annotations. The rule is that a test may
  claim a scenario only if it asserts that scenario's THEN outcome.
