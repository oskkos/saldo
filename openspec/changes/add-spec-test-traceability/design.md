## Context

`openspec/specs/` holds 10 capabilities with 122 scenarios. The test suite has two
layers: Jest (`src/**/__tests__/`, jsdom, Prisma/session mocked) and Playwright
(`e2e/`, real browser against `saldo_test`). Nothing machine-readable connects the
two. The one existing link — a requirement→scenario→test markdown table in
`e2e/README.md` — is hand-written, time-clock only, and cannot be verified.

Constraints discovered in the repo that shape the design:

- **No TypeScript runner for standalone scripts.** No `tsx`, no `ts-node`, and CI
  runs Node 20 (`.github/workflows/build.yml`), which predates `--experimental-strip-types`.
  A tool written in TS would need a new dependency and a build step.
- **No YAML parser dependency.** `openspec/config.yaml` is read by the openspec CLI,
  not by app code.
- **`openspec/` and `docs/` are both in `.prettierignore`**, and `lint-staged` only
  covers `*.{js,jsx,ts,tsx}`. Generated markdown in either directory survives the
  pre-commit hook and `prettier --check .` untouched.
- **A precedent for derived traceability already exists.** The user-guide generator
  stamps each page with a footer of requirement content hashes (12 hex chars) and has
  a read-only status mode that reports staleness. This change reuses that idea for
  tests.

## Goals / Non-Goals

**Goals:**

- One machine-readable link per (scenario, test) pair, living next to the test.
- A committed, generated map that answers "what covers this scenario?" and "what has
  no test?" without running anything.
- CI enforcement strong enough that a new scenario cannot merge without a test, and a
  renamed or deleted scenario cannot leave a dangling test link.
- A visible signal when a scenario's wording changes after a test was linked to it.
- Every one of the 122 scenarios resolved in this change: covered by a test, or
  exempt with a written reason.

**Non-Goals:**

- Measuring test quality or code coverage. Codecov already reports line coverage; this
  tool reports *scenario* coverage and says nothing about assertion depth.
- Generating tests from scenarios.
- Enforcing that each scenario has a *dedicated* test. Many-to-many is expected: one
  test may cover several scenarios, one scenario may be covered by several tests.
- Extending traceability to `openspec/changes/**` delta specs. Only canonical specs in
  `openspec/specs/` are the source of truth, matching how the user-guide generator
  works.
- A `--since <ref>` mode that enforces only PR-touched scenarios. Full enforcement
  makes it unnecessary.

## Decisions

### Annotation in the test, map generated from it

The link lives in the test file as a comment, and `openspec/COVERAGE.md` is derived.

*Alternatives considered.* A central hand-edited mapping file — rejected because the
link sits away from the test, so renaming a test silently breaks it and reviewers
never see the obligation in the diff they are already reading. Back-annotating the
spec files with "Covered by" lines — rejected because `openspec/specs/**` is owned by
the propose/sync/archive pipeline, and generated content there would collide with
spec syncs.

Keeping both (annotation as truth, map as generated artifact) costs one thing: the map
must be regenerated and committed when annotations change, and CI fails when it
wasn't. That is the same contract the user-guide footers already impose, so it is a
familiar failure mode rather than a new one.

### `// @scenario capability/Scenario title` — one syntax for both layers

```ts
// @scenario time-clock/Clock in when idle
it('records the session start', () => { ... })
```

Stacked comment lines declare multiple scenarios. An annotation on a `describe` /
`test.describe` applies to every test inside it.

*Alternative considered.* Playwright's native `annotation: [{ type, description }]`
API, which would surface in the HTML report. Rejected: it only exists in Playwright,
so the Jest layer would need a second convention and the tool a second extraction
path — two parsers for a marginal reporting gain. A comment works identically in both
layers, needs no runtime hook, and does not alter test names or output.

### Scenario ID is `capability/Scenario title`; hash covers the scenario body

All 122 scenario titles are currently unique repo-wide, so no requirement segment is
needed in the ID — which keeps annotations short and stable when a scenario moves
between requirements. Uniqueness is not left to luck: duplicate titles within a
capability are a hard error, so the ID can never become ambiguous.

The hash is the first 12 hex characters of sha256 over the scenario's WHEN/THEN body
with whitespace normalized, matching the user-guide footer convention.

*Trade-off.* The hash deliberately excludes the parent requirement's prose. Including
it would churn every sibling scenario's hash on a typo fix; excluding it means a
meaning change made *only* in requirement text does not flag the scenarios beneath it.
Scenario bodies are what tests assert, so that is the better anchor.

### The hash lives in the generated map, not in the annotation

A reworded scenario shows up as a changed hash in the `openspec/COVERAGE.md` diff,
on the row that also lists the tests to re-verify.

*Alternative considered.* Putting the hash in the annotation (`.../Clock in when idle@d0ccf9e6`)
and failing CI on a mismatch. Stronger — a stale test cannot stay green — but every
spec wording tweak turns CI red until each linked test file is touched, which trains
people to bump hashes without reading. Map-side hashing puts the same information in
front of a reviewer without manufacturing red builds.

### Exemptions are data, with reasons

`scripts/spec-coverage.exemptions.json`:

```json
[{ "scenario": "user-guide-generation/*", "reason": "Claude skill workflow; no app code path" }]
```

Capability-level wildcards are allowed; per-scenario entries are the norm. JSON rather
than YAML because no YAML parser is available to a dependency-free script.

Exemptions are self-policing: an entry naming an unknown scenario is a hard error (so
they cannot rot), and an entry for a scenario that *is* annotated is a hard error (so
coverage that later arrives forces the exemption out). This is what keeps the exempt
list from becoming a place to hide work.

### Plain ESM script, zero dependencies

`scripts/spec-coverage.mjs` on `node:fs`, `node:path`, `node:crypto`. Runs on Node 20
in CI with no build step and no new dependency.

*Alternative considered.* A `.ts` script — would require `tsx` plus either a build
step or a loader flag. Not worth it for one file of parsing.

Test-file scanning is line-based rather than AST-based: collect consecutive
`// @scenario` lines, then require the next non-blank, non-comment line to open an
`it` / `test` / `describe` call with a plain string literal. Anything else is a hard
error, so the parser fails loudly instead of silently dropping a link. Using the
TypeScript compiler API would be more robust but pulls a heavyweight traversal into a
script whose whole job is reading comments.

### CI fails on gaps and on drift

`npm run spec:coverage` regenerates the map; `npm run spec:coverage:ci` (`--check`,
`--strict`) verifies without writing, as a step in the existing `build-and-test` job —
no database or browser needed. Exit 1 on: an uncovered, non-exempt scenario; an
annotation citing an unknown scenario; an annotation not attached to a test; a
non-literal test title under an annotation; an unknown or stale exemption; a coverage
map that differs from a fresh generation.

Enforcement is on from the start *because* this change closes every gap first. The
`--strict` flag stays separable so the tool remains usable in report-only mode if the
gate ever has to come off.

## Risks / Trade-offs

- **Annotations can over-claim** — a test can name a scenario it does not really
  verify, and no tool can catch that. → The rule is written into CLAUDE.md and the
  spec: a test may claim a scenario only if it asserts that scenario's THEN. Code
  review is the check, and the generated map makes each claim visible in the diff.
- **Enforcement pressure can produce shallow tests** just to clear the gate. →
  Exemptions with reasons are the sanctioned escape hatch, so "this is not
  automatable" is a legitimate, reviewable answer instead of a token test.
- **Line-based parsing is fragile against unusual formatting** (an annotation
  separated from its test by a blank comment block, a title built from a template
  literal). → These are hard errors with file:line, not silent skips, so the failure is
  immediate and obvious.
- **Scenario titles are the ID, so renaming a scenario breaks every annotation citing
  it.** → Intentional: the break is exactly the signal that a test needs re-reading.
  The error message names the file, line and old ID.
- **The map is another generated file that can go stale in a PR.** → `--check` fails
  the build, and regenerating is one command.
- **Backfill is large** (annotating 18 test files plus writing tests for three
  capabilities with no coverage). → Tasks are grouped per capability so each lands as
  its own commit, and the tool's first run produces the authoritative gap list rather
  than a guess.

### This change must cover its own capability before the gate goes on

`spec-test-traceability` adds 29 scenarios of its own, and the tool reads only
canonical `openspec/specs/**`. That creates an ordering problem: before the archive
sync, annotations citing those 29 scenarios are unknown-scenario errors and
exemptions for them are unknown-exemption errors — but after the sync, they are 29
uncovered scenarios that turn the new gate red.

So the delta is promoted with `/opsx:sync` as an implementation step (task group 7),
before the CI step is added, and the tool's own tests are annotated in the same
group. The archive step then only moves the folder, because the sync has already
happened.

*Alternative considered.* Letting the tool also read the active change's delta specs,
which would remove the ordering constraint. Rejected: it contradicts the
canonical-specs-only rule the user-guide generator already follows, and it would make
coverage depend on which changes happen to be in flight.

## Migration Plan

The tool ships in report-only usefulness from its first commit (the map generates
even while gaps exist), and the CI step is added last, after the final capability's
gaps are closed and after the self-coverage bootstrap above. That ordering keeps the
branch's intermediate commits honest without a red pipeline. Rollback is removing the
CI step; nothing in the app depends on the script.
