## Why

Users report two forms of accidental double-counting. Tapping a submit button
twice creates two identical worklogs, because no button in the app is disabled
while a mutation is in flight and no write path rejects a repeat. Separately,
hours logged from one device can overlap hours already logged from another,
because nothing compares a new entry against what is already stored. Both inflate
the saldo silently — the number the whole app exists to report.

The two are the same missing invariant at different speeds: a duplicate is an
overlap whose bounds happen to match exactly. The absence write path already
enforces its own one-per-day invariant in the repository; regular worklogs have
no equivalent.

## What Changes

- **`useTransitionWrapper` becomes a re-entrancy guard.** A synchronous ref check
  drops a second call while the first is still running, and an exposed `busy`
  flag disables the control that triggered it. Today the hook's `isPending` is
  discarded at every call site, and would not help if it were used: the
  server round-trip is awaited *before* `startTransition`, so the flag is false
  for exactly the window a double-tap lands in. Ten components instantiate the
  hook across thirteen invocations; all of them are updated.
- **BREAKING (internal): mutation actions return a result value instead of the
  written row.** `onWorklogSubmit`, `onWorklogEdit`, and `onClockOut` return a
  discriminated union carrying success, a conflict, or an error message,
  mirroring `onAbsenceSubmit`. A thrown error's message is replaced with an
  opaque digest in a production build, so a conflict the user must read cannot be
  thrown.
- **Server-side overlap detection for work entries.** A new entry or edit that
  overlaps an existing *work* worklog comes back as a conflict naming the
  offending entry; the user confirms and the write proceeds with an explicit
  override. Absence rows are exempt on both sides — logging hours on an absence
  day stays a supported combination.
- **Repeated clock-out stops double-logging.** `clockOutWithWorklog` becomes
  idempotent by writing only when a session is actually open, matching the guard
  `clockIn` already uses.
- **Modal confirm buttons no longer dismiss the dialog implicitly**, so a
  conflict prompt can resolve against a modal that is still open.
- **The worklog table gains an index on `(user_id, from)`**, so the overlap
  lookup a write now performs is not a scan.

Not in scope: repairing duplicate or overlapping rows already stored, and a
database-level exclusion constraint (a user may deliberately confirm an overlap,
so the invariant is advisory and cannot be enforced by the database).

## Capabilities

### New Capabilities

- `mutation-safety`: One user interaction produces at most one mutation. Covers
  in-flight gating of every client-triggered write, the silent dropping of
  re-entrant submissions, and the rule that a dropped submission reports nothing.

### Modified Capabilities

- `worklog`: Adds overlap detection between work entries with user confirmation,
  and changes the create/edit mutation contract to return outcomes as values
  rather than throwing them.
- `time-clock`: Adds the requirement that clocking out twice creates one worklog,
  and brings clock-out under the overlap confirmation.
- `data-load-performance`: Adds the requirement that per-user worklog lookups
  bounded by a date range are index-backed, now that a write performs one.

## Impact

**Code**

- `src/util/useTransitionWrapper.ts` — reworked; all ten consumers updated
  (`worklogEntry`, `dayExpectedOverride`, `absence`, `settings`,
  `expectedHoursOverrides`, `quickAddModal`, `worklogEditModal`,
  `worklogDeleteConfirm`, `clockCard`, `clockOutModal`).
- `src/actions/index.ts` — return types of `onWorklogSubmit`, `onWorklogEdit`,
  `onClockOut`; a confirmation flag on their inputs.
- `src/repository/worklogRepository.ts` — overlap query and guard beside the
  existing `assertAbsenceDaysAreFree`.
- `src/repository/clockRepository.ts` — conditional session close.
- `src/components/modal.tsx` — confirm button type and explicit close.
- `src/types/index.ts` — result and conflict types.
- `prisma/schema.prisma` + a migration — the `(user_id, from)` index.

**Behaviour**

- Overlapping work entries now require one extra confirmation before saving.
- Existing stored overlaps are untouched and are not reported.
