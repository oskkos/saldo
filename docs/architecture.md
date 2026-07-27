# Architecture

Saldo is a server-first Next.js App Router application. Almost every page is an async
server component that reads its own data; the client bundle exists for the parts that
genuinely need interactivity — forms, the clock, the charts.

## The domain in one paragraph

The **saldo** is a running balance between the hours a user actually worked and the
hours expected of them. It is computed forward from the user's `begin_date`, seeded
with an initial balance, and expected minutes accrue only on working days — weekends
and public holidays (via `date-holidays`) are skipped. The default expectation is
`EXPECTED_HOURS_PER_DAY = 7.5` (`src/constants/index.ts`), overridable per user in
settings and per date through `ExpectedHoursOverride`. The whole calculation lives in
`src/services/index.tsx` and touches neither the database nor the session.

## Layers

```
page / component  →  action  →  repository  →  Prisma  →  PostgreSQL
                        │
                     services  (pure; no DB, no session)
```

The direction matters more than the names. Nothing skips a layer inward, and nothing
reaches back outward.

### `src/app/` — pages and routes

App Router pages, async server components by default. Route groups: `(calendar)` for
the home view, `(login)` for signin/signup/forgot/reset. The NextAuth route handler
lives under `api/`.

Pages read data by calling repository functions directly. There is no API layer
between a page and its data, because a server component already runs on the server —
adding one would only add a network hop and a second place for authorization to be
forgotten.

### `src/actions/` — the mutation boundary

One `'use server'` module. Every mutation in the app goes through it: worklog CRUD,
settings, the clock, signup, password reset.

An action validates its input against a Zod schema from `src/schemas/`, then delegates
to a repository. This is the only place a client component is allowed to trigger a
write.

**Return errors the user should read; do not throw them.** A production build replaces
the message of anything thrown out of a server action with an opaque digest, so a
thrown error that reads perfectly in `next dev` says nothing at all in production.
`onAbsenceSubmit` returning its conflict is the worked example. This is not a style
preference — it is the difference between a useful toast and an empty one, and it is
invisible until you test against a real build.

### `src/repository/` — data access and the authorization gate

`server-only` modules, one per aggregate: worklog, settings, clock, user,
expected-hours override.

Every function starts by calling `getUserFromSession()` and throws if there is no
user. Functions that touch an existing row additionally compare `user_id` against the
session user and throw `'User mismatch.'` on a mismatch — an id in a URL is not
evidence of ownership. Because the gate lives here rather than in the pages, a new
page cannot forget it.

Database calls are wrapped in `Sentry.startSpan`.

This layer is also the translation boundary. Prisma's rows are `snake_case` and shaped
by the schema; the rest of the app speaks the `camelCase` domain types in
`src/types/`. Mapper functions (`toWorklog` and friends) convert on the way out.
**Prisma types do not leak past this layer** — that is what keeps the schema free to
change without a rewrite above it.

### `src/services/` — pure business logic

The saldo calculation, worklog summing and sorting, minutes↔badge formatting. No
database, no session, no I/O. This is the layer that is cheap to test exhaustively,
which is why the interesting rules live here rather than inside a component.

`forgotPasswordMailSender.ts` is the exception that proves it — it talks to Mailjet,
and it sits alone.

### `src/auth/` — NextAuth configuration

JWT session strategy, with Credentials, Google and GitHub providers. On first sign-in
`onAfterSignin` upserts the user and seeds default `Settings`. The user's numeric
database id is stashed on the token as `token.userId` and surfaced as
`session.user.id`; `getUserFromSession()` is the gate every repository call goes
through.

## Directory map

| Path              | Files | What lives there                                                     |
| ----------------- | ----- | -------------------------------------------------------------------- |
| `src/app/`        | ~59   | Pages, route groups, layouts, the NextAuth handler                    |
| `src/components/` | ~64   | Client components — forms, clock, mini calendar, worklog items        |
| `src/repository/` | ~12   | `server-only` data access; ownership enforced here                    |
| `src/util/`       | ~12   | Date helpers, branded date types, assertion guards, duration maths    |
| `src/schemas/`    | ~11   | Zod schemas, one per form                                             |
| `src/auth/`       | ~6    | NextAuth options and session helpers                                  |
| `src/actions/`    | ~5    | The single `'use server'` module and its tests                        |
| `src/services/`   | ~3    | Pure domain logic — the saldo calculation                             |
| `src/types/`      | ~2    | Domain types (`Worklog`, `Settings`, `User`, `AbsenceReason`, …)      |
| `src/constants/`  | 1     | `EXPECTED_HOURS_PER_DAY`, worklog defaults, theme names               |
| `src/generated/`  | —     | Generated Prisma client. Not hand-edited, not in `node_modules`       |

Tests sit in `__tests__/` directories beside the code they cover.

## Conventions that bite

These are the ones that cause wrong code rather than untidy code.

### All date maths is UTC

`src/util/date.ts` calls `dayjs.tz.setDefault('UTC')` and exports the helpers the app
should use — `add`, `subtract`, `startOfDay`, `endOfDay`, `sameDay`, `diffInMinutes`,
`isWeekend`, `isHoliday`, `isNonWorkingDay`, `now`. Reaching for `dayjs` directly
reintroduces the local timezone and produces a saldo that is correct on your machine
and wrong on the server. The Playwright suite deliberately runs the app server in a
non-UTC timezone to catch exactly this.

### Branded date types

`src/util/dateFormatter.ts` defines opaque string types — `Date_ISODay`, `Date_Time`,
`Date_YearAndMonth` — and `src/util/assertionFunctions.ts` provides the guards that
construct them (`assertIsISODay`, `assertIsTime`, `assertIsYearAndMonth`,
`assertIsAbsenceReason`, `assertExists`).

They are all `string` at runtime; the brand exists purely so the compiler can tell
`'2026-07-27'` from `'08:00'`. Prefer them over raw strings when passing formatted
dates around, and construct them through the guards rather than casting — a cast
asserts a format nobody checked.

### The Prisma client is generated to `src/generated/prisma`

Import from `@/generated/prisma/client`, never from `@prisma/client`. Run
`prisma generate` after any schema change; `postinstall` covers a fresh clone.

### The path alias is `@/*` → `src/*`

Configured in both `tsconfig.json` and the Jest config, so it resolves the same in
tests.

## Data model

Six Prisma models in `prisma/schema.prisma`:

- **`User`** — email, optional name and password (null for OAuth-only accounts).
- **`Settings`** — one per user: `begin_date`, initial balance, default from/to times,
  `expected_minutes_per_day` (default 450 = 7.5 h).
- **`Worklog`** — a `from`/`to` pair on a user, with an optional comment, a
  `subtract_lunch_break` flag, and an optional `absence`. An absence is a worklog with
  its `absence` column set, not a separate table.
- **`Absence`** (enum) — `holiday`, `flex_hours`, `sick_leave`, `other`.
- **`ExpectedHoursOverride`** — per-date expected minutes with an optional label.
- **`PasswordResetData`** — reset token and expiry, one per user.

## Where to read next

- [Testing](testing.md) — the two layers, and how a spec scenario becomes a test.
- [`e2e/README.md`](../e2e/README.md) — the Playwright harness in detail.
- [`openspec/specs/`](../openspec/specs/) — the behaviour these layers implement,
  written as requirements and scenarios.
