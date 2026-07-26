## Why

Nothing stops a user from recording two absences on the same day, and the saldo
credits each absence record separately while charging the day's expected minutes
only once. Two absences on a working day therefore invent a full expected day of
balance out of nothing, and the mini-calendar renders the day as an ordinary
absence, so the error has no visible cause. The `absence` spec already carries
this as an open question ("No overlap detection").

The same asymmetry, seen from the other side, is a feature worth pinning down:
logging hours on a day that already has an absence adds exactly those hours to
the saldo, which is how an exceptional day worked during a holiday is meant to
settle without a manual balance correction.

## What Changes

- At most one absence may exist per user per UTC calendar day. Any absence
  reason blocks any other reason on that day — not only a repeat of the same
  reason — because every non-flex reason credits the day's expected minutes and
  a second credit is wrong whatever it is called.
- An absence date range is written all-or-nothing in a single transaction. If
  any day in the range already has an absence, nothing is written and the error
  names the conflicting days. This replaces the current per-day `Promise.all`,
  which could persist part of a range (the `// TODO: Handle all in one call` in
  `absence.tsx`).
- Logging hours on a day that already has an absence stays allowed, leaves the
  absence untouched, and adds the worked minutes to the saldo. This is existing
  behaviour, promoted from accident to specified requirement.
- The day view tells the user when the day already has an absence and that hours
  logged there still count.
- The mini-calendar shows an absence day's logged hours next to the reason icon.
  Today the icon replaces the hours, so work done on an absence day is invisible
  on the home calendar — a gap this change would otherwise widen by making that
  combination a supported workflow.
- `/absence` reads the user's configured default times instead of the
  `NEW_WORKLOG_DEFAULT_*` module constants, which is what the `absence` spec
  already claims and what every other entry surface already does.
- Partial-day absences are settled as unsupported: an absence is consumed in
  full and hours worked on top are added, resolving an open question rather than
  adding a new storage shape.

Not in scope: cleaning up duplicate absences already in the database, a
database-level uniqueness constraint, and an editing UI for absences.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `absence`: gains a uniqueness requirement (one absence per day), an
  atomicity requirement for range creation, and a requirement that hours may be
  logged on an absence day. The default-times requirement is restated against
  the user's configured settings. Three open questions are resolved and removed.
- `saldo`: gains a requirement that hours logged on a day that also has a
  non-flex absence add to the balance on top of the balance-neutral absence.

## Impact

- `src/repository/worklogRepository.ts` — new absence-day lookup and a
  transactional multi-insert; the uniqueness guard sits beside the existing
  ownership check in `insertWorklog` and `updateWorklog`.
- `src/actions/index.ts` — a new absence-range action replacing the client-side
  per-day loop; validated by a new Zod schema.
- `src/services/index.tsx` — pure range-expansion and conflict-message logic.
- `src/app/absence/` — one submit call, and defaults read from settings.
- `src/app/worklog-entry/worklogEntry.tsx` — the absence hint.
- `src/components/miniCalendar/` — icon and hours shown together.
- `openspec/specs/absence/`, `openspec/specs/saldo/` and
  `openspec/COVERAGE.md`.

No database migration, no dependency change. A residual race remains: two
genuinely simultaneous submissions could both pass the check. Accepted for
single-user data rather than paid for with a raw partial index Prisma cannot
express.
