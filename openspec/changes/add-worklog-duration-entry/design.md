## Context

Worklogs are stored and computed entirely from a `from`/`to` `DateTime` pair.
That pair does three jobs at once: it defines the **duration** (`to − from`,
minus 30min when `subtractLunchBreak`), the **day** the work counts against
(saldo skips non-working days and compares to `beginDate`), and the **ordering**
within a day (`sortWorklogs` sorts by `from`). Duration-based entry only supplies
the first; the day and a sensible start still have to come from somewhere.

Two facts make a light-touch approach viable:

1. The entry form already prefills `from` with the user's `fromDefault` setting
   (default 08:00) and `to` with `toDefault`. The common flow today is already
   "accept the default start, set the end, save." A duration entry is just
   "accept the default start, and set the end = start + duration."
2. The recently shipped clock-in/clock-out feature is a `from`/`to` generator, so
   the `from`/`to` pair must remain the source of truth. Dropping it is not an
   option.

Both entry surfaces — `QuickAddWorklogModal` and `WorklogEditModal` — already
render the shared `WorklogInputs` component, so a mode toggle added there lights
up both automatically.

## Goals / Non-Goals

**Goals:**

- Let users enter a worklog by duration (hours + minutes) instead of start/end.
- Reuse the existing `fromDefault` setting as the start anchor for new entries.
- Keep the stored data model, saldo calculation, actions, and repository
  untouched — duration is an input-layer affordance only.
- Make the lunch-break interaction unambiguous and saldo-preserving.

**Non-Goals:**

- No new stored field, Prisma column, or domain-type change.
- No change to how saldo is computed (`worklogMinutes` still = `to − from − lunch`).
- No duration entry in the clock-in/out flow (that path inherently has real times).
- No free-text duration parsing ("7h30", "7.5") — numeric inputs only.

## Decisions

**Decision: Duration mode is pure UI state that writes into the existing
`from`/`to` fields.** The mode is local component state in `WorklogInputs`. When
the hours/minutes change, the component computes `to = anchor + duration` and
writes `from = anchor`, `to`, `subtractLunchBreak = false` into the existing
`WorklogFormDataEntry` shape. Everything downstream (`toWorklogFormData`, the
action, the repository, saldo) is unchanged.

- *Alternative considered — a stored `duration`/`entry_type` column (faithful
  round-trip so edits re-show "7h 30min").* Rejected: costs a migration and a
  second entry mode to maintain forever, and buys little once the anchor is
  `fromDefault` — the synthesized times are the same data the form's own default
  would produce, so re-showing them on edit is a faithful representation, not a
  fiction. The lossiness (can't tell an entry *was* typed as a duration) does not
  affect saldo or correctness.
- *Alternative considered — drop `from`/`to`, store day + minutes.* Rejected: the
  clock feature needs real times, and it would rewrite saldo's day/ordering
  anchoring.

**Decision: Duration means net worked minutes, not the raw span.** The number the
user types is exactly what contributes to saldo (`worklogMinutes`). In Duration
mode the lunch-break checkbox is hidden and the saved flag is `false`, because the
break is already folded into the entered number. This matches how saldo is
displayed everywhere (`7h 30min`) and avoids double-subtraction.

- *Alternative considered — duration = span, keep a hidden lunch flag.* Rejected:
  a hidden control that still silently subtracts 30min is a trap; the displayed
  number would not equal the saldo contribution.

**Decision: Anchor = existing `from` if present, else `fromDefault`.** New entries
(QuickAdd) have no start, so they anchor on the user's default start. Editing an
entry that has a real start (e.g. 09:15) keeps it, so bumping "8h" gives
09:15–17:15 rather than resetting to 08:00. `WorklogInputs` takes an `anchor`
prop: QuickAdd passes `fromDefault`; the edit modal passes the worklog's own
`from` time.

**Decision: Reject when `anchor + duration` crosses midnight.** Surface a
duration-specific message in the UI ("Duration is too long for a start of HH:MM").
The existing server-side same-day / positive-duration refinements in
`worklogSchema.tsx` remain the backstop — without a UI guard they would fire, but
with the confusing "End time must be after start time" message.

**Decision: Edit form opens in Times mode.** It reflects the stored
representation as-is, so a comment-only edit never rewrites the times. Times are
only re-synthesized if the user deliberately toggles to Duration. Switching a
lunch-subtracted worklog to Duration prefills `worklogMinutes(worklog)` (the net).

## Risks / Trade-offs

- **Lunch↔Duration collapse is one-directional and lossy** → Documented as a
  deliberate choice in the spec. Toggling an 08:00–16:00 + lunch entry to
  Duration and back yields 08:00–15:30 with no lunch: same saldo, different stored
  times. Only reachable by explicitly toggling; saldo never changes.
- **Duration-entered start time is synthetic** → Anchoring on `fromDefault` (for
  new entries) or the real existing `from` (for edits) makes it the same value the
  form would otherwise carry, so it reads as a sensible default rather than a
  fabricated time.
- **Two-layer overflow rejection** (UI message + schema refine) → The UI guard is
  for a good message; the schema refine is the real gate, so a UI regression can't
  persist a bad row.

## Migration Plan

No data migration. Purely additive UI + input-conversion logic. Ships behind no
flag; existing worklogs and the Times mode are unaffected. Rollback = revert the
UI change; stored data is identical to what Times mode produces.

## Open Questions

- Exact copy for the mode toggle (e.g. "Times / Duration" segmented control vs. a
  checkbox) and the overflow error message — left to implementation.
