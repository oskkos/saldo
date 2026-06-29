## Why

Logging hours today is fully manual: the user picks a day and from/to times and
submits a complete worklog. A common ask is a **timecard**: tap to start the
workday, tap to end it, and have the worklog created automatically with the right
length. This removes the friction of remembering and entering exact times, and
makes the app usable in the moment rather than after the fact.

## What Changes

- Introduce a **time-clock**: a per-user open work session. Clocking in records a
  start time; clocking out creates a worklog spanning start → end.
- Add persistent state for the open session: a nullable `startedAt` on the user.
  At most one open session per user at a time.
- **Timestamps are captured client-side** (the user's wall-clock, stored as a
  UTC instant — the existing `now()`/`toDate` convention), so the logged times
  match what the user sees on their clock.
- On clock-out, show a **finalize sheet**: the computed duration, a lunch-break
  toggle, an optional comment, and three actions — **Save** (create the worklog),
  **Discard** (drop the session, no worklog), or **Cancel** (stay clocked in).
- **Forbid overnight sessions** (consistent with the worklog single-day rule): if
  a session crosses midnight or is otherwise implausible, the finalize sheet opens
  in a corrective mode with editable, same-day-constrained times before saving (or
  the user can Discard).
- Surface the clock state in the UI: a **clock card** on the home screen (start
  button when idle; live elapsed timer + clock-out when running) and a **clocked-in
  indicator on the saldo badge** (a pulsing dot) so the running state is
  visible from any page.

Out of scope (deliberately): background/auto-close of forgotten sessions (no job
infrastructure), proactive notifications, and any change to the storage or
display model (still wall-clock-as-UTC, displayed verbatim).

## Capabilities

### New Capabilities
- `time-clock`: starting/stopping a work session and turning it into a worklog,
  including the open-session state, client-captured timestamps, the finalize
  sheet (save/discard/cancel), overnight handling, and the clock-state UI.

### Modified Capabilities
<!-- none — clock-out reuses the existing worklog create flow; the single-day
     worklog rule already enforces the overnight constraint. -->

## Impact

- **Schema**: add `started_at DateTime?` to the `User` model (+ migration).
- **Repository**: a clock module — `getActiveSession`, `clockIn(startedAt)`,
  `clockOut`/discard. Clock-out save reuses `insertWorklog`.
- **Actions**: `onClockIn`, `onClockOut` (save with finalized data), `onClockDiscard`.
- **Types**: an active-session shape in `src/types`.
- **UI**: a client `ClockCard` on the home page, the finalize sheet (daisyUI
  modal, like `quickAddModal`), and the saldo-badge indicator. No new dock item.
- **Auth/seed**: `startedAt` defaults to null; no seeding change needed.
