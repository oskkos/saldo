## Why

Worklog and settings mutations have no server-side validation. The actions
(`onWorklogSubmit`, `onWorklogEdit`, `onSettingsUpdate`) pass their input
straight to the repository. The only guards are client-side: the forms assert
date/time *format* and, for settings, that from < to — but nothing re-checks
those invariants on the server. A buggy or non-UI caller can persist a worklog
whose `to` is before its `from`, a zero-duration entry, an out-of-range absence
reason, or settings with an inverted time range — and that bad data flows
straight into the saldo calculation and statistics. This also contradicts the
project's own architecture rule: "actions validate input with Zod, then delegate
to repositories" — which the auth actions already follow but these do not.

## What Changes

- Add Zod validation to the worklog write actions (`onWorklogSubmit`,
  `onWorklogEdit`) covering: `to` strictly after `from`, a recognized absence
  reason (or none), and a comment within a sane length.
- Add Zod validation to `onSettingsUpdate` covering: required `beginDate`,
  default `from` before default `to`, and bounded initial-balance values.
- Validation failures surface as thrown errors carrying a human-readable
  message, matching how the worklog/settings forms already display errors via
  toast (these forms do not use react-hook-form, so structured field errors are
  not needed here).
- Validation lives in the action layer, re-establishing invariants regardless of
  what the client sends. Repositories are unchanged.

Out of scope (separate proposals):
- Absence-reason editing (the edit form omits the `absence` field; the repository
  omission currently shields against wiping it).
- Overlap/duplicate detection for worklogs and absences on the same day.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `worklog`: Add a requirement that worklog create/edit validate input
  server-side (positive duration, valid absence reason, bounded comment) before
  persisting.
- `settings`: Add a requirement that settings update validate input server-side
  (required begin date, from < to, bounded initial balance) before persisting.

## Impact

- **Code**: `src/actions/index.ts` (worklog + settings actions); new Zod schemas
  under `src/schemas/` (e.g. `worklogSchema`, `settingsSchema`). Repositories and
  UI unchanged.
- **Specs**: `worklog` and `settings` deltas resolving their "no server-side
  validation" open questions.
- **Behavior**: invalid mutations now fail with a clear error instead of
  silently persisting; valid mutations are unaffected. Verified via new unit
  tests for the schemas/actions and `npm run test:ci`.
