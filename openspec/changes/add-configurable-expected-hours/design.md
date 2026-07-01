## Context

Expected daily hours are the constant `EXPECTED_HOURS_PER_DAY = 7.5`. It feeds
the saldo in two places in `services/index.tsx` — the expected-minutes accrual
(`expectedMinutesUntilToday`) and the non-flex absence credit — and, critically,
a **third** place found while exploring: the mini-calendar day coloring in
`components/miniCalendar/dayItem.tsx` compares each day's worked minutes to a
hardcoded `450` (7.5h) to pick red/yellow/green. That magic number is the same
constant in disguise.

The absence credit is the subtle coupling: a non-flex absence is not modelled on
the expected side — it adds `EXPECTED_HOURS_PER_DAY` of *synthetic worked* minutes
so the day nets to zero. The moment expected hours vary per day, that credit must
track the same per-day value or absences stop netting to zero.

## Goals / Non-Goals

**Goals:**

- A per-user configurable default expected hours.
- Per-date overrides for reduced (or otherwise different) expected hours on
  specific days.
- One resolver as the single source of truth, consumed by all three sites.
- Correct absence behavior on overridden days (still balance-neutral).
- Calendar coloring that reflects the resolved expected, with a visible marker
  for override days.

**Non-Goals:**

- Configurable lunch break (`EXPECTED_MINUTES_LUNCH_BREAK`) — a worked-time
  deduction, not an expected obligation; nobody has asked, and it is a trivial
  same-pattern addition later.
- Recurring overrides, holiday-calendar-derived overrides, custom weekly
  working-day patterns, effective-dated rate ranges, per-day balance display.

## Decisions

**Decision: One `resolveExpectedMinutes(date, settings, overrides)` resolver.**
Precedence: per-date override → `0` if `isNonWorkingDay` → configurable default.
Both saldo call sites and the calendar coloring call it. This centralizes three
scattered references (two `EXPECTED_HOURS_PER_DAY`, one `450`) into one function
and makes overrides/absences compose for free.

- *Alternative — patch each site independently.* Rejected: guarantees drift (the
  `450` already drifted from the named constant once) and risks the absence
  credit falling out of sync with the accrual.

**Decision: Overrides store absolute minutes, not a delta.** The client thinks in
absolute terms ("that day is 5h"). Stored as an `Int` (300/360/450…), matching how
`initial_balance` is stored. A delta would be harder to reason about and to
display.

**Decision: New `ExpectedHoursOverride` table; default lives on `Settings`.** The
default is one scalar and belongs with the other per-user config
(`expected_minutes_per_day Int @default(450)`). Overrides are a variable-length
per-date collection, so a table keyed `@@unique([user_id, date])` with an optional
`label`. Both are per-user and ownership-enforced at the repository boundary.

**Decision: Absence credit and accrual both use the resolver, keyed on
"resolved expected > 0" for the working-day test.** The old code branched on
`isNonWorkingDay`; it now branches on whether resolved expected is zero. This lets
an override turn a weekend into a working day (or a weekday into a 0-expected day)
consistently across accrual, credit, and coloring.

**Decision: Calendar uses two orthogonal visual channels.** Border **color** =
met the day's resolved expected (red/yellow/green, threshold = resolved expected
instead of `450`); border **style** = dashed for override days, solid otherwise.
Color answers "did I meet it," style answers "was this a special day." The
overrides + default must be plumbed from the home page into the (client)
`MiniCalendar` and through `daysForCalendarBuilder` so each `DayItem` knows its
day's expected.

**Decision: Settings page hosts the batch list; day view is the in-context
editor.** A "Special days" section on the settings page lists overrides with
independent add/edit/delete server actions — **not** wired into the settings
form's single Submit. The day view shows a read `Expected today: Xh (custom)`
line plus an inline override editor. The day-view line is deliberately kept even
if the inline editor is trimmed, so the resolved value is never invisible.

**Decision: The configurable default is retroactive, and the UI says so.**
`expectedMinutesUntilToday` recomputes the whole history each load, so changing
the default re-expects all past days. Effective-dating it (date-ranged rates) is
a Non-Goal; instead the settings field carries a one-line warning. Overrides
carry no such risk — each affects only its own date.

## Risks / Trade-offs

- **Absence credit drifting from accrual** → Both call the one resolver; a test
  asserts an overridden short day taken as absence nets to zero.
- **Calendar data plumbing** → `MiniCalendar` is a client component fed only
  `beginDate` + `worklogs` today; it now also needs the default + overrides. The
  home page already loads settings, so it is one more prop down an existing path,
  but the overrides must reach the client, not just the server-side saldo calc.
- **Retroactive default** → Documented in the UI; acceptable for this client, who
  sets the default once. Revisit with effective-dated ranges only if a real
  "my hours changed permanently" need appears.
- **Override list growth over years** → For this client's volume (a handful/year)
  the settings-page list is fine; a sub-page with a year filter is the escape
  hatch if it ever grows long. Not built now.

## Migration Plan

- Prisma migration: add `Settings.expected_minutes_per_day Int @default(450)`
  (existing rows backfill to 450 = today's behavior, so no balance shifts on
  deploy); create `ExpectedHoursOverride`. Run `prisma generate`.
- No data backfill needed for overrides (none exist).
- Rollback: the feature is additive; reverting the code leaves an unused column
  and table. A follow-up migration can drop them if the change is abandoned.

## Open Questions

- Should the override editor also be reachable from the mini-calendar (click a
  day → set its expected), or is day-view + settings enough for v1? Leaning
  day-view + settings.
- Optional `label` auto-suggestion from the holiday calendar is possible (the app
  knows Finnish holidays) but deferred; v1 label is freeform and optional.
