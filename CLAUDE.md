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
npm run lint         # eslint (max-warnings=0) + prettier --check
npm run lint:fix     # eslint --fix + prettier --write
```

- **Run a single test:** `npx jest src/services/__tests__/someFile.test.ts` (add `-t "name"` to filter by test name). `npm test` defaults to watch mode and will not terminate.
- Husky pre-commit runs `lint-staged`; commit-msg enforces Conventional Commits (commitlint). Keep commits conventional or they will be rejected.

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

### `/opsx:apply` — commit per task, verify, then push
- Review the diff; never blind-commit.
- **Commit once per top-level task group** in `tasks.md` (each commit carries that group's code plus its `tasks.md` checkbox updates). Intermediate commits need not independently build — only the branch tip must be green (tests + lint + typecheck).
- When apply is done, **pause and ask the user to manually verify** the implementation and for any change suggestions. **Push only once the user gives the OK.**
- **Do not archive in this step.**

### `/opsx:archive` — sync + archive while the PR is open
- **Timing:** run it while the **PR is still open**, once everything is **reconciled and mergeable** (CI green, review addressed) — it does not wait for formal approval.
- When prompted, choose **"Sync now"** before the folder move — otherwise canonical specs drift from the change being archived.
- **One dedicated commit** covering **both** the spec sync and the folder move:
  ```
  docs(openspec): sync <capability> spec(s) and archive <change-name>
  ```
  Commit it **verbatim** — generated output (sync deltas + the `mv` to `changes/archive/YYYY-MM-DD-<name>`). Don't hand-edit; if a synced spec looks wrong, fix the delta spec and re-run. Keep it **isolated from implementation commits** so the move renders as a rename and reverts as a unit.
- After the archive commit, **push**.
