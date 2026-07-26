# End-to-end tests (Playwright)

Browser tests that drive the real app against a dedicated Postgres database.
Every capability with a user-facing surface is covered here — time-clock,
worklog, settings, absence, statistics and saldo — and CI enforces that a new
requirement arrives with a browser test or a written reason not to (see
[Requirement-level coverage](#requirement-level-coverage) below).

## Running locally

```bash
docker compose up -d db                                   # Postgres on localhost:3006
docker compose exec -T db psql -U postgres \
  -c "CREATE DATABASE saldo_test"                         # once; ignore "already exists"
cp .env.e2e.example .env.e2e                              # once
npm run test:e2e                                          # runs migrations + seed + tests
# npm run test:e2e:ui                                     # watch/debug in the Playwright UI
```

`playwright.config.ts` loads `.env.e2e`, applies migrations and seeds the test
user in `global-setup`, then boots the app on **port 3100** (so it never collides
with a dev server on 3000). The app server runs in a non-UTC timezone on purpose,
to prove the clock scenarios are timezone-independent.

## How it works

- **`db.ts`** — a standalone Prisma client against `saldo_test` (not the app's
  server-only singleton). Seeds worklogs, absences, settings and expected-hours
  overrides, and resets the test user to a known baseline between tests.
- **`ui.ts`** — the locators shared across suites: `:visible` scoping (the
  quick-add dialog duplicates every field), the month accordions in the worklog
  list, the saldo badge as signed minutes.
- **`global-setup.ts`** — `prisma migrate deploy` + seed, once per run.
- **`auth.setup.ts`** — signs in once via the Credentials form and saves the
  session (`e2e/.auth/user.json`); every test reuses it.
- **`fixtures.ts`** — where every spec gets its `test` from. It wraps the `page`
  fixture to collect browser coverage; without coverage enabled it hands the page
  through untouched.

## Coverage

Off by default. `npm run test:e2e:coverage` turns on one switch (`E2E_COVERAGE`) that
the build reads for source maps, `playwright.config.ts` reads to point the app server at
a `NODE_V8_COVERAGE` directory, and `fixtures.ts` reads to start `page.coverage`. Then
`npm run coverage:e2e:report` converts both runtimes' profiles into
`coverage-e2e/{server,browser}/lcov.info`. CI does this and uploads both under the `e2e`
flag; see the coverage-reporting section of [`CLAUDE.md`](../CLAUDE.md) for why the two
runtimes stay separate.

**Take `test` from `./fixtures`, never from `@playwright/test`.** That import is what
starts the profiler, and a spec that bypasses it is silently left out of coverage — so
`scripts/__tests__/e2e-coverage.test.ts` scans this directory and fails the build on one.
Importing `expect` or `type Page` from the runner is fine; only `test` matters.

**Coverage here measures execution, not assertion.** A component counts as covered
because a test rendered it, not because anything asserted its behaviour. What a test
actually proves is recorded through the scenario annotations below.

## Writing a test here

**Assertions must be date-agnostic.** `page.clock` controls only the browser;
the server decides the accrual window and the future-entry exclusion against the
real clock. So seed relative to today (`utcDay(-3)`, `pastWorkingDayOffsets(2)`)
and assert relationships, never figures — the suite has to pass on a Tuesday in
March and on a Finnish public holiday alike.

`saldo.spec.ts` shows the two techniques that make that work: seeding a worklog
and re-reading the badge isolates what the worklog contributed, and reading the
badge with and without a day in the accrual window isolates that whole day's
contribution — worked and expected minutes together, which a plain before/after
cannot see.

**Reset per test.** The suite is serial and shares one user, so a leaked row
surfaces in the next test. `resetUserData()` in `beforeEach`.

## Scenario → test traceability

Which spec scenarios these tests cover is recorded in the generated coverage map
at [`openspec/COVERAGE.md`](../openspec/COVERAGE.md), not here — a hand-written
table drifts silently, and two records of the same thing eventually disagree.

Each test declares what it covers with an annotation directly above it:

```ts
// @scenario time-clock/Clock in when idle
test('clock in when idle shows the clocked-in state', async ({ page }) => {
```

Regenerate the map with `npm run spec:coverage` after changing annotations; CI
runs `npm run spec:coverage:ci`, which fails on an uncovered scenario, a stale
map, or an annotation naming a scenario that no longer exists. A test may claim
a scenario only if it asserts that scenario's THEN outcome.

## Requirement-level coverage

On top of the per-scenario rule, every **requirement** in `openspec/specs/` needs
at least one of its scenarios covered by a test in this directory. The layer is
derived from the file's path, so nothing extra is written in the annotation.

The bar is per requirement rather than per scenario deliberately: one browser
test of the journey is enough, and the rules beneath it stay where they are
pinned most precisely.

When a requirement genuinely should not have a browser test, add an entry under
`requirementsWithoutE2e` in `scripts/spec-coverage.exemptions.json` with one of
four categories and a reason in your own words:

| Category              | Means                                                             |
| --------------------- | ----------------------------------------------------------------- |
| `no-ui`               | The requirement has no user-visible surface at all.               |
| `unit-appropriate`    | Observable, but pinned more precisely at a lower layer.           |
| `external-dependency` | Needs a third party the test environment cannot drive.            |
| `harness-cost`        | Declined deliberately: the setup outweighs the confidence gained. |

`harness-cost` also requires `coveredAt`, naming a test file that does cover the
requirement, and that file must exist. It is the only category that asserts a
judgement rather than a fact about the requirement, so the claim is made
checkable rather than left unfalsifiable.

Exemptions cannot rot: one naming a requirement that no longer exists fails the
run, and so does one for a requirement that has since gained a Playwright test —
coverage arriving later forces the exemption out rather than hiding behind it.

One known gap in the mechanism: the tool counts **annotations, not test
results**. A `test.fixme` or `test.skip` carrying `// @scenario` lines reports
coverage that never runs. Delete a test you cannot make pass, or exempt its
requirement honestly — do not leave it skipped with its annotations attached.
