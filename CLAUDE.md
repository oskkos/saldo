# CLAUDE.md

Guidance for Claude Code (claude.ai/code) working in this repository.

The prose lives in [`docs/`](docs/) — [architecture](docs/architecture.md),
[testing](docs/testing.md), [contributing](docs/CONTRIBUTING.md),
[getting started](docs/getting-started.md). Read the relevant page before a
non-trivial change. What follows is the short list of things that produce **wrong
code** if you do not know them.

## What this is

Saldo tracks work hours. Its domain concept is the **saldo** — the running balance
between hours worked and hours expected (`EXPECTED_HOURS_PER_DAY = 7.5`), computed
from a user's begin date forward, skipping weekends and public holidays. The
calculation is in `src/services/index.tsx`.

Next.js 16 (App Router) · React 19 · TypeScript (strict) · Prisma 7 + PostgreSQL ·
NextAuth 4 · Tailwind 4 + daisyUI · Zod + react-hook-form · Chart.js · dayjs · Sentry.

## Rules

**Layers.** `page/component → action → repository → Prisma`, with `services` pure and
off to the side. Do not skip a layer.

- `src/app/` — pages, async server components by default; they call repositories directly.
- `src/actions/index.ts` — the single `'use server'` module. Every mutation goes here:
  validate with a Zod schema, then delegate. The only place a client component may
  trigger a write.
- `src/repository/` — `server-only`. Every function calls `getUserFromSession()` first
  and enforces per-user ownership. Prisma types **do not leak past this boundary**;
  map to the `camelCase` types in `src/types/`.
- `src/services/` — pure. No DB, no session.

**Return user-facing errors from actions; do not throw them.** A production build
replaces a thrown error's message with an opaque digest, so a toast that reads fine in
`next dev` is empty in CI and in production. `onAbsenceSubmit` is the worked example.

**All date maths is UTC.** Use the helpers in `src/util/date.ts` (which sets
`dayjs.tz.setDefault('UTC')`), never `dayjs` directly.

**Use the branded date types** — `Date_ISODay`, `Date_Time`, `Date_YearAndMonth` from
`src/util/dateFormatter.ts` — and construct them with the `assertIs*` guards in
`src/util/assertionFunctions.ts` rather than casting.

**The Prisma client is generated to `src/generated/prisma`**, not `node_modules`.
Import from `@/generated/prisma/client`. Run `prisma generate` after schema changes.

**Path alias `@/*` → `src/*`.** Tests live in `__tests__/` beside the code.

## Commands

```bash
npm run dev          # port 3000
npm run test:ci      # Jest ONCE — `npm test` is watch mode and will not exit
npx jest <path>      # a single file; add -t "name" to filter
npm run test:e2e     # Playwright (one-time setup — see docs/testing.md)
npm run lint         # eslint --max-warnings=0 + prettier --check
npm run spec:coverage # regenerate openspec/COVERAGE.md
```

The pre-commit hook runs Prettier over staged JS/TS only — **it does not run ESLint**
(`.lintstagedrc.js` declares the same glob twice). Run `npm run lint` yourself.
Commit messages must be Conventional Commits; commitlint rejects anything else.

## Tests and specs

Every scenario in `openspec/specs/` needs a test or an exemption, and every requirement
needs a Playwright test or a categorised one. Declare coverage above the test:

```ts
// @scenario time-clock/Clock in when idle
```

Claim a scenario only if the test asserts that scenario's THEN. Regenerate and commit
`openspec/COVERAGE.md` when annotations or specs change — CI fails on a stale map.
Every e2e spec takes `test` from `e2e/fixtures.ts`, never `@playwright/test`.
Full rules: [docs/testing.md](docs/testing.md).

## After every change: check the docs

Documentation here is hand-written and nothing detects its drift, so **check it as
part of the change, not afterwards**. Ask what the change altered, and update the file
that describes it in the same commit series:

| If the change touched…                              | Check                                              |
| --------------------------------------------------- | -------------------------------------------------- |
| A command, script, or env var                        | `docs/getting-started.md`, and this file's Commands |
| A layer boundary, convention, or the Prisma schema   | `docs/architecture.md`, and this file's Rules       |
| How tests run, coverage, or the traceability rules   | `docs/testing.md`, `e2e/README.md`                  |
| The commit, PR, or OpenSpec workflow                 | `docs/CONTRIBUTING.md`                              |
| Features, screenshots, or the stack                  | `README.md`                                         |
| Anything user-visible                                | Regenerate the user guide (below)                   |
| A capability's behaviour                             | `openspec/specs/` via the sync step                 |

Say explicitly which docs you checked and why nothing needed changing, when nothing
did. Silence reads as "not considered".

The user guide (`docs/user-guide/`) is generated — do not hand-edit its pages. Run
`/generate-user-guides` (`--check` for a staleness report).

## OpenSpec workflow (`/opsx:*`)

**explore → propose → apply → archive**, one PR per change. The `/opsx:*` commands do
not touch git; drive git yourself at the points below. `openspec/` is in
`.prettierignore` and lint-staged only runs on `*.{js,jsx,ts,tsx}`, so spec markdown is
never reformatted by the hook.

**`/opsx:explore`** — planning and investigation only. No git actions.

**`/opsx:propose`** — `git fetch origin develop`, branch from `origin/develop`
(untracked proposal files carry across the switch), generate the artifacts, then commit
`docs(openspec): propose <change-name>`, push, and open a PR against `develop`. The PR
exists from the proposal stage; apply commits land on it.

**`/opsx:apply`** — review the diff; never blind-commit. **One commit per top-level task
group** in `tasks.md`, each carrying that group's code plus its checkbox updates. Only
the branch tip must be green.

Finish with the spec sync in its own commit:

```
docs(openspec): sync <capability> spec(s) for <change-name>
```

Run `/opsx:sync`, then `npm run spec:coverage`, and commit the synced specs with the
regenerated `COVERAGE.md`. This must happen here, not at archive: `spec-coverage.mjs`
reads only `openspec/specs/`, so a change adding scenarios leaves every annotation
citing them unresolvable — and CI red — until the delta reaches the canonical specs.

The sync applies requirements only. **Open Questions the change resolves are yours to
remove by hand** — the delta format has no operation for them, and a resolved question
left in place is a false statement in the canonical spec. Check every capability the
change touches, not only those with a delta.

When apply is done, **pause and ask the user to verify** the implementation. **Push
only once they give the OK.** Do not archive in this step.

**`/opsx:archive`** — run it while the PR is **still open**, once everything is
reconciled and mergeable (CI green, review addressed); it does not wait for formal
approval. If the change was edited after the sync, re-run the sync first. Then **one
dedicated commit** for the folder move, verbatim generated output, isolated from
implementation commits so it renders as a rename and reverts as a unit:

```
docs(openspec): archive <change-name>
```

Push after the archive commit.
