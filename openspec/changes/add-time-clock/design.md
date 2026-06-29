## Context

Worklogs are completed `from`/`to` pairs created through manual entry or the
quick-add modal. The app has no concept of in-progress state. A timecard needs a
persistent open session between clock-in and clock-out, plus UI to start/stop it
and turn it into a worklog. The app stores wall-clock values as UTC instants
(`toDate`/`now()` use `keepLocalTime`); the saldo and worklog rules operate in
UTC, and worklogs must fall on a single calendar day.

## Goals / Non-Goals

**Goals:**
- One-tap start/stop that auto-creates a correctly-sized worklog.
- Open-session state that survives reload and is visible from any page.
- Reuse the existing worklog create path and the wall-clock-as-UTC model.

**Non-Goals:**
- Background/auto-close of forgotten sessions (no job infrastructure exists).
- Push/proactive notifications.
- Multiple concurrent sessions per user.
- Any change to storage/display semantics or to the worklog/saldo rules.

## Decisions

**Decision: Store the open session as `User.startedAt DateTime?`.**
Simplest model that fits "one open session per user": null = clocked out, set =
clocked in since that instant. Rejected a dedicated `ActiveTimer` table (more
schema for no MVP gain) and an open Worklog with null `to` (would make `to`
nullable and ripple through the saldo calc and display — too invasive).

**Decision: Capture timestamps client-side as wall-clock-as-UTC.**
The clock-in/out instants must be the user's wall-clock so the logged times match
their clock. Captured in the browser via the existing `now()` (keepLocalTime),
not server-side — a Vercel (UTC) server would otherwise shift the times by the
user's offset. Trade-off: the client controls the timestamp; acceptable for a
personal tracker (no incentive to cheat; times are editable).

**Decision: Clock-out goes through a finalize sheet with Save / Discard / Cancel.**
- Save → create the worklog from the (possibly edited) times via `insertWorklog`,
  apply the lunch toggle and optional comment, clear `startedAt`.
- Discard → clear `startedAt`, create no worklog (light confirm, it is destructive).
- Cancel → dismiss, remain clocked in.
The sheet shows duration, a lunch-break toggle (defaulting to the app default),
and an optional comment. Reuses the daisyUI modal pattern (`quickAddModal`).

**Decision: Forbid overnight; the finalize sheet doubles as the corrective UI.**
A normal same-day session confirms directly. If the raw session crosses midnight
(rejected by the single-day worklog rule) or is implausibly long, the sheet opens
in corrective mode: pre-filled, flagged, with `to` editable and constrained to the
clock-in day, so the user fixes it before Save — or Discards. No separate surface.

**Decision: Forgotten sessions are handled reactively, not automatically.**
No background job. On return, the clock card shows the stale running state with a
warning; clocking out routes through the corrective sheet. Crossing midnight is
the one hard trigger; a soft "long but same-day" threshold is out of MVP (still a
valid worklog).

**Decision: Two UI surfaces, no new dock item.**
- `ClockCard` on the home screen (fills the currently-empty space below the
  calendar): start button when idle; live elapsed (client `setInterval`) +
  clock-out when running.
- Saldo badge shows a clocked-in indicator (pulsing dot + live elapsed),
  tappable to clock out, so the state is visible app-wide. The bottom dock is
  already at five items, so nothing is added there.

## Risks / Trade-offs

- [Client-captured timestamps are user-controlled] → Acceptable for a personal
  tracker; entries are editable after the fact.
- [now() is keepLocalTime — must stay so the clock matches stored times] →
  Already documented in `date.ts`; this feature depends on it.
- [Forgotten session produces an invalid (cross-midnight) span] → The corrective
  finalize sheet (or Discard) is the safety net; the single-day rule guarantees a
  bad span cannot be silently saved.
- [Live timer in a client component re-rendering each second] → Cheap; isolate
  the ticking to a small component.

## Open Questions

- **Soft long-session threshold** — should an unusually long *same-day* session
  (e.g. > 12h) get a gentle confirm even though it is valid? Deferred; not in MVP.
