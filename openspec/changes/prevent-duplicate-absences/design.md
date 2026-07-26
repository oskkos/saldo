## Context

An absence is not its own model: it is a `Worklog` with the `absence` column set
(`prisma/schema.prisma`). The saldo calculation grants the day's resolved
expected minutes **per absence record** (`src/services/index.tsx`,
`calculateCurrentSaldo`) while charging the expectation **per day**
(`expectedMinutesUntilToday`). That asymmetry is the whole subject of this
change:

```
Working day, expectation 450 min

  absence            absence + absence     absence + 3h worklog
  ────────────       ─────────────────     ─────────────────────
  credit  +450       credit  +450          credit  +450
                     credit  +450          worked  +180
  charge  -450       charge  -450          charge  -450
  ────────────       ─────────────────     ─────────────────────
  net        0       net     +450  wrong   net     +180  wanted
```

Absences are created only from `/absence`, which today loops over the range and
fires one `onWorklogSubmit` per day through `Promise.all`, carrying a
`// TODO: Handle all in one call`. A partial failure already leaves part of a
range persisted. Absences cannot be edited: the edit button is hidden for them
(`worklogItem.tsx`) and `updateWorklog` never writes the `absence` column.

There are four write paths into the `worklog` table, not three —
`clockRepository.ts` creates its own row inside a transaction rather than going
through `insertWorklog`. It only ever writes regular worklogs, so it cannot
create a duplicate absence, but it shows that the write surface fragments over
time.

## Goals / Non-Goals

**Goals:**

- One absence per user per UTC calendar day, enforced wherever an absence is
  written.
- An absence range is written whole or not at all, with an error that names the
  days that blocked it.
- Logging hours on an absence day stays possible, leaves the absence alone, and
  raises the balance by the hours worked.
- The two surfaces that currently hide this combination — the day view and the
  month calendar — show it.

**Non-Goals:**

- Repairing or reporting duplicate absences already in the database.
- A database-level uniqueness constraint.
- An editing UI for absences (reason or date).
- Partial-day absences, or any change to how an absence's stored times are read
  by the saldo.
- Re-deriving the calendar's border colouring.

## Decisions

### The guard lives in the repository, beside the ownership check

Uniqueness is a state-dependent invariant that needs a read before the write,
which is exactly the shape of the per-user ownership check that `updateWorklog`
and `deleteWorklog` already enforce in `worklogRepository.ts`. Putting it there
means no future action can bypass it by forgetting a call, and it keeps the
action layer as the Zod-validation layer that `CLAUDE.md` describes.

*Alternative considered:* the action layer. Rejected because `clockRepository`
already demonstrates a write path that does not go through the actions' usual
repository entry point, and because a guard is only as good as the caller that
remembers it.

*Cost accepted:* `insertWorklog` gains a conditional. It returns immediately
when `absence` is undefined, so the common case still issues one query.

The `updateWorklog` guard fires only when the **stored** record is an absence.
Moving a regular worklog onto an absence day is a supported action and must not
be blocked. Since `updateWorklog` never writes the `absence` column, an absence
being edited stays an absence, so the stored value is the whole test.

### The rule is "any absence blocks any absence", and Prisma cannot express it

Every reason except `flex_hours` credits the day, so a second record of any
reason is a second claim on the same day. Blocking only same-reason collisions
would leave `holiday + sick_leave` — a full phantom day — legal.

This rules out a declarative constraint. `@@unique([user_id, from, absence])` is
the only shape Prisma can express, and because Postgres treats NULLs as distinct
it would allow regular worklogs to coexist (wanted) but also allow
`holiday + sick_leave` (not wanted) — precisely the weaker rule. The correct
constraint is partial (`WHERE absence IS NOT NULL`), which needs a raw migration
and permanent drift-watching. Not worth it here; see Risks.

### The range is checked once, then written in one transaction

`/absence` calls a single new action with the whole range. The action expands
the range, asks the repository for the days already taken, and either throws
before writing anything or inserts every day inside one `prisma.$transaction`.
This satisfies the all-or-nothing requirement and retires the existing
`// TODO: Handle all in one call` in the same stroke.

Conflict detection queries once for the range rather than once per day.

### Range expansion and message wording are pure functions

Expanding a from/to pair into days, and turning a list of conflicting days into
a sentence, are side-effect-free and belong in `src/services`. They are the
parts most worth unit-testing and the parts that would otherwise be duplicated
between the range path and the single-record path.

The message reads `An absence is already recorded for 28.07.2026.`, formatted
with `toDayMonthYear` so it matches how days are shown elsewhere in the UI. More
than three conflicting days are truncated to the first three plus a count, so a
month-long range does not produce an unreadable toast.

### Existing duplicates are left alone, and the spec says so

Blocking writes does not repair history. The alternative — making the saldo
credit idempotent per day — would fix historical data too, but it was
deliberately declined: it would silently change existing balances, and the
`absence` spec now states outright that the rule covers new writes only. A
reader who later finds a phantom day should find the limitation documented
rather than assume the calculation defends itself.

### Two adjacent surfaces are corrected in the same change

Both are gaps this change would otherwise widen by making absence-plus-hours a
supported workflow:

- `/absence` is the only entry surface that ignores the user's configured
  default times, using the `NEW_WORKLOG_DEFAULT_*` constants instead. The
  `absence` spec already claimed the configured times, so the code is what is
  wrong. `absence/page.tsx` gains a `getSettings()` read and passes defaults
  down, matching `worklog-entry/page.tsx`.
- `calendarCell.tsx` renders the reason icon **instead of** the day's hours, so
  work done on an absence day leaves no trace on the month calendar. Icon and
  hours are shown side by side.

The hours shown on such a day must exclude the absence's own stored times.
`calculateWorklogsSum` counts every record by its raw times, so an absence
contributes its synthetic 450 minutes; a holiday day with 3 hours worked would
read "10.5h". The calendar needs the non-absence sum for display. The border
colouring keeps using the existing total, so day colours do not move.

## Risks / Trade-offs

- **Two simultaneous submissions could both pass the check** → Accepted. The
  window is between the read and the write of a single user's own data, reachable
  only by double-submitting from two clients at the same instant. The fix is a
  raw partial index whose maintenance cost outweighs the scenario.
- **Historical duplicates keep inflating balances** → Accepted and documented in
  the `absence` spec. A one-off query can find them if it ever matters; no code
  defends against them.
- **`insertWorklog` gains a read on the absence path** → Bounded: one indexed
  query per absence write, skipped entirely for regular worklogs.
- **The calendar cell is 40px wide (48px on `sm`)** → Icon and hours together
  are tight on the narrowest breakpoint. Shipping the straightforward
  side-by-side layout and refining the sizing afterwards if it reads badly on a
  real phone.
- **The day-view notice could be read as a warning** → It is informational, and
  its wording says hours still count, precisely to prevent the user concluding
  that the day is closed to entry.
