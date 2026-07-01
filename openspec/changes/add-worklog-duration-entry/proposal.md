## Why

Entering a worklog today requires a `from`/`to` time pair, but users often know
only *how long* they worked ("7h 30min"), not the exact clock times. Forcing a
start and end time is friction for that common case. Since the entry form already
prefills the start with the user's configured default start time, we can offer a
duration-based entry that reuses that default as the anchor — no new data model,
no change to how saldo is computed.

## What Changes

- Add a **Duration** entry mode to the shared worklog form (`WorklogInputs`),
  toggled against the existing **Times** mode. Duration mode replaces the
  From/To time inputs with two numeric inputs: **Hours** and **Minutes**.
- The duration entered is the **net worked time** — the value that counts toward
  saldo (`worklogMinutes`), not the raw span. In duration mode the
  "subtract lunch break" checkbox is hidden, because the lunch break is already
  reflected in the number the user types.
- On save, duration mode synthesizes the stored `from`/`to`:
  - **Anchor** = the worklog's existing `from` when editing an entry that has
    one, otherwise the user's `fromDefault` setting.
  - `from` = anchor, `to` = anchor + duration, `subtractLunchBreak` = false.
- If `anchor + duration` would cross midnight (i.e. not fall on the same day),
  the entry is **rejected with a clear error** rather than silently wrapping.
- The edit modal opens in **Times** mode by default so a comment-only edit never
  rewrites the stored times; switching a lunch-subtracted worklog into Duration
  mode prefills the net minutes and, on save, folds the lunch break into the
  duration (saldo is preserved; the stored end time and lunch flag change).
- No database, Prisma schema, domain type, action, or repository changes. The
  stored shape remains a `from`/`to` pair; duration is purely an input-layer
  affordance.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `worklog`: adds a requirement covering duration-based entry — its net-minutes
  semantics, the anchor rule (existing `from` else `fromDefault`), lunch-break
  handling, and same-day (overflow) rejection.

## Impact

- **UI:** `src/components/worklogInputs.tsx` (toggle + hours/minutes inputs +
  anchor plumbing + an `allowDuration` opt-out prop). All four `WorklogInputs`
  consumers pass the anchor:
  - `src/components/quickAddModal.tsx` — anchor = `fromDefault`.
  - `src/app/worklog-entry/worklogEntry.tsx` — the full-page manual entry form;
    anchor = `fromDefault`, Submit disabled while a duration is invalid.
  - `src/components/worklogItem/worklogEditModal.tsx` — anchor = the worklog's
    own `from`.
  - `src/components/clock/clockOutModal.tsx` — passes `allowDuration={false}` to
    stay Times-only (the clock-out path has real start/end times).
- **Conversion:** `src/util/worklogFormData.ts` and/or a small duration helper
  to synthesize `from`/`to` from an anchor + minutes and to compute net minutes
  from an existing worklog.
- **Validation:** overflow (same-day) rejection surfaced with a duration-specific
  message; the existing server-side same-day / positive-duration refinements in
  `src/schemas/worklogSchema.tsx` remain the backstop.
- **No change** to `src/services/index.tsx` (saldo), `src/actions/index.ts`,
  `src/repository/`, Prisma schema, or `src/types/index.ts`.
