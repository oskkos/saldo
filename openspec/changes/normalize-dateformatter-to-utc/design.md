## Context

The app stores wall-clock values as UTC instants: `toDate` (in `date.ts`) parses
a user's `day`/`time` and applies `.tz('UTC', true)` (`keepLocalTime`), so an
entered `08:00` is persisted as `08:00Z` — the typed clock, labelled UTC, with no
timezone conversion. Reading such a value back correctly therefore means
formatting in UTC. `dateFormatter.ts` does this for `toTime`/`toDayMonthYear` but
not for the seven formatters that call plain `dayjs(date)`, which use the runtime
local timezone. This split is the bug.

## Goals / Non-Goals

**Goals:**
- Make every formatter read timestamps in UTC, so output equals the stored
  wall-clock in any runtime timezone.
- Make day-bucketing (statistics, mini-calendar, worklog lists) deterministic.
- Lock the behavior with timezone-pinned tests.

**Non-Goals:**
- **Storing true UTC instants and localizing to the viewer's browser timezone.**
  This was explicitly considered (Helsinki enters 08:00 → store 05:00Z → show
  08:00 in Helsinki, 01:00 in New York) and rejected: it requires capturing the
  user's timezone server-side, reworking the saldo day-math to bucket in that
  timezone, and migrating existing verbatim data — disproportionate for a
  single-user-per-timezone work tracker. See "Decisions".
- Changing `date.ts` or the entry path. Storage/entry already use the verbatim
  model consistently.

## Decisions

**Decision: Keep the wall-clock-as-UTC verbatim model; display verbatim.**
Each user enters and reviews their own hours from one timezone. "08:00 means
08:00" with no conversion is the correct, simplest behavior. Cross-timezone
viewing is not a real use case for this app.

- *Alternative considered: store true UTC + localize to viewer.* Correct in a
  textbook sense and standard for multi-user/multi-region apps, but it forces
  server components (which render in UTC on Vercel) to know the viewer's
  timezone, makes the saldo "which working day" attribution timezone-dependent,
  and requires a data migration. Rejected as disproportionate; revisit only if
  multi-timezone sharing becomes a real requirement.

**Decision: Use `dayjs.utc(date)`, not `dayjs.tz(date, 'UTC')`.**
`dayjs.utc()` is explicit and self-contained. `dayjs.tz()` depends on
`dayjs.tz.setDefault('UTC')` having run (it lives in `date.ts`), a load-order
coupling `toDayMonthYear` currently relies on. Switching the whole module to
`dayjs.utc()` removes that coupling.

**Decision: Add UTC-boundary fixtures; defer the non-UTC timezone pin.**
The suite sets no `TZ`, so it inherits UTC on CI and passes regardless of the
bug; existing fixtures (`01:23Z`) also avoid the midnight boundary. We add
fixtures at low UTC hours that cross midnight in negative-offset zones, asserting
the UTC output. A true regression guard needs the suite to *run* in a non-UTC
timezone — but see "Discovered During Implementation": that can only be done
reliably by a global pin, which is unsafe until the rest of the suite is
timezone-robust. So the boundary fixtures are documentation-grade here, and the
global non-UTC pin is deferred to the `date.ts` follow-up.

## Risks / Trade-offs

- [A non-UTC user currently sees locally-shifted days; "fixing" changes what
  they see] → This is the intended correction (output becomes the stored
  wall-clock). Production is UTC, so prod display is unchanged.
- [Pinning Jest TZ globally could shift other date-dependent tests] → Verify the
  full suite passes under the pinned TZ; adjust any test that implicitly assumed
  UTC.
- [`date.ts` `add()` uses plain `dayjs(d)` for `Date` args] → Out of scope, but
  inspect during implementation to confirm it is not a second instance of the
  same bug.

## Discovered During Implementation

Pinning the Jest timezone globally (to expose the `dateFormatter` bug) revealed
that **the entire `date.ts` module is timezone-dependent** — `startOfDay`,
`endOfDay`, `add`, `subtract`, `daysInMonth`, `isWeekend` all compute in the
runtime's local timezone — and that **the saldo calculation inherits this** (its
result shifted, e.g. `-45min` → `-8h15min`, under `America/New_York`). Several
test suites (`services`, `date`, `miniCalendar`) also use local-constructed
fixtures (`new Date(y, m, d)` / non-`Z` strings) that assume the runtime is UTC.

Decision: **stay narrow.** This change remains scoped to `dateFormatter.ts`. A
global Jest TZ pin was tried and reverted because it broke the timezone-fragile
suites. A *scoped* runtime pin (`process.env.TZ` in `beforeAll`) was then tried
and also abandoned: Node caches the timezone at process startup, so a runtime
reassignment has no effect — CI proved this when the guard test, expecting a
non-UTC offset, saw `0` on the UTC runner. The only reliable pin is a global one
set before process start, which is unsafe until the whole suite is
timezone-robust. So the boundary fixtures remain as UTC-contract documentation
and the real regression guard moves to the `date.ts` follow-up. The
`miniCalendar` test, whose assertions broke because the `dateFormatter` fix is
correct, was made timezone-robust by using a UTC date literal.

The broader `date.ts` / saldo timezone-fragility is **pre-existing and
production-safe** (Vercel runs in UTC) and is recorded as a follow-up open
question in `openspec/specs/saldo/spec.md`. It deserves its own change because it
touches the core calculation and needs a "UTC-production behavior provably
unchanged" verification.
