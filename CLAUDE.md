# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Saldo is a work-hours tracking app. Its core domain concept is the **saldo** — the running balance between hours actually worked and hours expected (`EXPECTED_HOURS_PER_DAY = 7.5`). The balance is computed from a user's `beginDate` forward, skipping non-working days (weekends + public holidays via `date-holidays`), with a configurable initial balance. See `src/services/index.tsx` for the calculation logic.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript (strict) · Prisma 7 + PostgreSQL (via `pg` adapter) · NextAuth 4 · Tailwind 4 + daisyUI · Zod + react-hook-form · Chart.js · dayjs · Sentry.

## Commands

```bash
npm run dev          # next dev (port 3000)
npm run build        # next build (outputs to build/ unless on Vercel)
npm test             # jest in WATCH mode — does not exit
npm run test:ci      # jest --ci --coverage — use this for a single run
npm run test:e2e     # playwright (time-clock e2e; see one-time setup below)
npm run test:e2e:ui  # playwright --ui (watch/debug)
npm run test:e2e:coverage   # same suite, collecting V8 coverage (slower; opt-in)
npm run coverage:e2e:report # convert the collected profiles into lcov
npm run lint         # eslint (max-warnings=0) + prettier --check
npm run lint:fix     # eslint --fix + prettier --write
```

- **Two test layers.** Jest (`src/**/__tests__`, jsdom) for unit/logic and server-layer code with Prisma/session mocked; Playwright (`e2e/`) for browser end-to-end. `test:ci` runs Jest only — `e2e/` is excluded from it.
- **Run a single test:** `npx jest src/services/__tests__/someFile.test.ts` (add `-t "name"` to filter by test name). `npm test` defaults to watch mode and will not terminate.
- **Running e2e** needs a one-time setup, then `npm run test:e2e`:
  ```bash
  docker compose up -d db
  docker compose exec -T db psql -U postgres -c "CREATE DATABASE saldo_test"  # once
  cp .env.e2e.example .env.e2e                                                # once
  ```
  It boots the app on port **3100** against `saldo_test` (never the dev DB), applies migrations, and seeds a test user. See `e2e/README.md` for the harness and scenario→spec traceability.
- Husky pre-commit runs `lint-staged`; commit-msg enforces Conventional Commits (commitlint). Keep commits conventional or they will be rejected.

### Coverage reporting

Both layers report line coverage to Codecov, each under its own flag — Jest as `unit`,
the Playwright suite as `e2e`. They cover near-complementary halves of the codebase
(Jest holds `services`/`repository`/`util`; Playwright drives every `page.tsx` and
component), so only the pair describes the whole.

```bash
npm run test:e2e:coverage    # E2E_COVERAGE=1: source maps, server profiler, browser collector
npm run coverage:e2e:report  # writes coverage-e2e/{server,browser}/lcov.info
```

- **Opt-in.** One switch (`E2E_COVERAGE`) drives the build's source maps,
  `NODE_V8_COVERAGE` on the app server, and the `page.coverage` collector in
  `e2e/fixtures.ts`. A plain `npm run test:e2e` is unaffected and writes nothing.
- **Every spec takes `test` from `e2e/fixtures.ts`,** not `@playwright/test` — that is
  what starts the browser profiler. A file that imports the runner directly is not
  collected and nothing about it looks wrong, so a Jest test fails the build on one.
- **One report per runtime, both uploaded under `e2e`.** They are not merged locally:
  the converter resolves both runtimes to the same source path but does not union their
  execution counts, so the server's zero would mask a browser hit for every file both
  touch. Codecov unions uploads within a flag.
- **The report step fails loudly** when a runtime contributed nothing, when no project
  source survives filtering, or when a path does not resolve on disk. Silent-empty is
  this mechanism's characteristic failure: the coverage service would carry the previous
  report forward and the number would stay plausible while ceasing to be true.
- **Execution is not assertion.** A file is green here because it ran, not because
  anything checked what it did — `navbar.tsx` renders on every page. Whether a scenario
  is actually asserted is what spec-to-test traceability below answers.

### Spec-to-test traceability

Two rules, both enforced by CI from the same annotations:

1. Every **scenario** in `openspec/specs/` must be covered by a test or explicitly exempt.
2. Every **requirement** must have at least one of its scenarios covered by a **Playwright** test, or carry a categorised end-to-end exemption.

```bash
npm run spec:coverage      # regenerate openspec/COVERAGE.md (commit the result)
npm run spec:coverage:ci   # what CI runs: --check --strict, writes nothing
```

- **Declare coverage next to the test**, in either layer (Jest or Playwright):
  ```ts
  // @scenario time-clock/Clock in when idle
  it('records the session start', () => { ... })
  ```
  Stack the comments to claim several scenarios; on a `describe` / `test.describe` the claim applies to every test inside. Many-to-many is fine — one test may cover several scenarios, and several tests may jointly cover one.
- **A test may claim a scenario only if it asserts that scenario's THEN.** No tool can catch an over-claim; this is a review check. If a scenario's THEN spans layers (e.g. "throws a validation error **and** nothing is written"), a schema-level test alone does not cover it — assert the persistence half at the action level too, or let two tests jointly cover it.
- **Regenerate and commit `openspec/COVERAGE.md`** whenever annotations or specs change; CI fails on a stale map. Renaming a scenario deliberately breaks the annotations citing it — that is the signal to re-read those tests.
- **Cannot be automated?** Add an entry under `scenarios` in `scripts/spec-coverage.exemptions.json` with a written reason (a `<capability>/*` wildcard is allowed). Exemptions are self-policing: one naming an unknown scenario fails, and so does one for a scenario a test already covers.
- **The end-to-end rule is per requirement, not per scenario** — one browser test of the journey is enough, so the rules beneath it don't each need one. The layer is read from the test's path (`e2e/**`); there is no extra syntax. A requirement whose scenarios are all scenario-exempt needs no end-to-end decision.
- **No Playwright test for a requirement?** Say why, under `requirementsWithoutE2e`, with one of four categories:

  | Category | Means |
  | --- | --- |
  | `no-ui` | The requirement has no user-visible surface at all. |
  | `unit-appropriate` | Observable, but pinned more precisely at a lower layer. |
  | `external-dependency` | Needs a third party the test environment cannot drive. |
  | `harness-cost` | Declined deliberately: the setup outweighs the confidence gained. |

  `harness-cost` additionally requires `coveredAt`, naming an existing test file that does cover it — it is the one category asserting a judgement rather than a fact, so the claim is made checkable. These exemptions rot the same way scenario ones do: an unknown requirement fails, and so does one that has since gained a Playwright test.

## Local setup (Docker Compose)

```bash
docker compose up -d db   # Postgres on localhost:3006
./run-migrations.sh       # prisma migrate deploy against localhost:3006
docker compose up         # app on localhost:3000
```

`POSTGRES_PRISMA_URL` is the connection string used everywhere. `NEXTAUTH_URL`/`NEXTAUTH_SECRET` and OAuth creds (`GOOGLE_*`, `GITHUB_*`) are required outside local dev. See `docs/getting-started.md`.

## Architecture — layered, server-first

Data flows `page/component → action → repository → Prisma`, with `services` holding pure business logic. Respect these boundaries:

- **`src/app/`** — App Router pages (all `async` server components by default) and the NextAuth route handler. Route groups: `(calendar)` (home), `(login)` (signin/signup/forgot/reset). Pages call repository functions directly to read data.
- **`src/actions/index.ts`** — the single `'use server'` module. All mutations (worklog CRUD, settings, signup, password reset) go through here. Actions validate input with Zod schemas, then delegate to repositories. This is the only place client components are allowed to trigger writes.
- **`src/repository/`** — `server-only` data access. Every function calls `getUserFromSession()` first and **enforces per-user ownership** (e.g. `updateWorklog`/`deleteWorklog` throw on `user_id` mismatch). DB calls are wrapped in `Sentry.startSpan`. Mapper functions (e.g. `toWorklog`) translate Prisma's `snake_case` rows into the `camelCase` domain types in `src/types`.
- **`src/services/index.tsx`** — pure, side-effect-free business logic (saldo calculation, worklog summing/sorting, minutes↔badge formatting). No DB or session access here.
- **`src/auth/`** — NextAuth config (`authSession.ts`). JWT session strategy; Credentials + Google + GitHub providers. On first sign-in, `onAfterSignin` upserts the user and seeds default `Settings`. The user's numeric DB id is stashed in the JWT (`token.userId`) and surfaced as `session.user.id`. Use `getUserFromSession()` as the auth gate in server code.

### Key conventions

- **Prisma client is generated to `src/generated/prisma`** (not `node_modules`). Import from `@/generated/prisma/client`. Run `prisma generate` after schema changes (also runs on `postinstall`).
- **Branded date types.** `src/util/dateFormatter.ts` defines opaque string types (`Date_ISODay`, `Date_Time`, `Date_YearAndMonth`, …) and `src/util/assertionFunctions.ts` provides `assertIs*` guards to construct/validate them. Prefer these over raw strings when passing formatted dates around — they catch format mismatches at the type level.
- **All date math is UTC.** `src/util/date.ts` sets `dayjs.tz.setDefault('UTC')`. Use the helpers there (`add`, `startOfDay`, `isNonWorkingDay`, etc.) rather than calling dayjs directly.
- **Domain types** (`Worklog`, `Settings`, `User`, `AbsenceReason`, form-data shapes) live in `src/types/index.ts`. The Prisma models are mapped into these at the repository boundary — don't leak Prisma types past it.
- **Path alias:** `@/*` → `src/*` (configured in both tsconfig and jest).
- Tests live in `__tests__/` dirs next to the code (jsdom environment, Testing Library). `__mocks__/next/navigation.ts` mocks router for component tests.

## OpenSpec workflow (`/opsx:*`)

The end-to-end pipeline is **explore → propose → apply → archive**, one PR per change. The `/opsx:*` commands themselves **do not touch git** — I drive all git actions (branch, commit, push, PR) as separate steps at the points below. `openspec/` is in `.prettierignore` and lint-staged only runs on `*.{js,jsx,ts,tsx}`, so spec markdown is never reformatted by the pre-commit hook. All commits use the enforced Conventional Commit types (commitlint rejects otherwise): `feat(...)`, `fix(...)`, `docs(...)`, `refactor(...)`, `test(...)`, scoped to the area touched.

### `/opsx:explore` — think, don't build
Planning and investigation only. No git actions.

### `/opsx:propose` — branch off fresh develop, then open the PR
- **Branch first:** `git fetch origin develop`, then create the change branch from `origin/develop` (untracked proposal files carry across the switch).
- Generate the artifacts (proposal/design/specs/tasks).
- Once planning is complete, propose: **commit the proposal** (`docs(openspec): propose <change-name>`), **push**, and **open a new PR** against `develop`. The PR exists from the proposal stage; apply commits land on it.

### `/opsx:apply` — commit per task, sync the specs, verify, then push
- Review the diff; never blind-commit.
- **Commit once per top-level task group** in `tasks.md` (each commit carries that group's code plus its `tasks.md` checkbox updates). Intermediate commits need not independently build — only the branch tip must be green (tests + lint + typecheck).
- **Finish with the spec sync**, in its own commit:
  ```
  docs(openspec): sync <capability> spec(s) for <change-name>
  ```
  Run `/opsx:sync`, then `npm run spec:coverage`, and commit the synced specs together with the regenerated `openspec/COVERAGE.md`. This has to happen here, not at archive: `scripts/spec-coverage.mjs` reads only `openspec/specs/`, so a change that adds scenarios leaves every annotation citing them unresolvable — and CI's `spec:coverage:ci` step red — until the delta reaches the canonical specs. Archiving is supposed to wait for green CI, so the sync cannot wait for archiving.
  - The sync applies the delta's requirements. **Open Questions the change resolves are yours to remove by hand** — the delta format has no operation for them, and a resolved question left in place is a false statement in the canonical spec. Check every capability the change touches, not only those with a delta.
- When apply is done, **pause and ask the user to manually verify** the implementation and for any change suggestions. **Push only once the user gives the OK.**
- **Do not archive in this step.**

### `/opsx:archive` — archive while the PR is open
- **Timing:** run it while the **PR is still open**, once everything is **reconciled and mergeable** (CI green, review addressed) — it does not wait for formal approval.
- The specs were already synced at the end of apply. If the change was edited after that, **re-run the sync first** so canonical specs do not drift from the change being archived; otherwise the prompt's "Sync now" is a no-op.
- **One dedicated commit** for the folder move:
  ```
  docs(openspec): archive <change-name>
  ```
  Commit it **verbatim** — generated output (the `mv` to `changes/archive/YYYY-MM-DD-<name>`). Keep it **isolated from implementation commits** so the move renders as a rename and reverts as a unit.
- After the archive commit, **push**.
