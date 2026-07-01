## 1. Duration conversion helpers

- [x] 1.1 Add a helper that converts an anchor start time + net minutes into `from`/`to` `Date_Time` values (and reports when the result crosses midnight), colocated with the other date/worklog form utilities (`src/util/`).
- [x] 1.2 Add a helper that derives net worked minutes from an existing worklog for prefilling Duration mode (reuse `worklogMinutes` semantics: `to − from − lunch`).
- [x] 1.3 Unit-test both helpers: default-start anchor, existing-`from` anchor, lunch-subtracted prefill, zero/negative duration, and midnight overflow.

## 2. Duration mode in the shared form

- [x] 2.1 Add an `anchor` (default start `Date_Time`) prop to `WorklogInputs` and a local `mode` state (`'times' | 'duration'`), defaulting to `'times'`.
- [x] 2.2 Add the Times/Duration toggle control and, in Duration mode, render Hours + Minutes numeric inputs (hours integer ≥ 0, minutes 0–59) in place of the From/To time inputs.
- [x] 2.3 On duration input change, compute and write `from = anchor`, `to = anchor + duration`, `subtractLunchBreak = false` into the `WorklogFormDataEntry`; hide the lunch-break checkbox while in Duration mode.
- [x] 2.4 When switching an existing worklog into Duration mode, prefill Hours/Minutes from its net worked minutes (task 1.2).
- [x] 2.5 Guard midnight overflow in the UI with a duration-specific error message and block submit while invalid.

## 3. Wire up the entry surfaces

- [x] 3.1 `QuickAddWorklogModal`: pass `fromDefault` as the anchor to `WorklogInputs`; disable Save while a duration is invalid.
- [x] 3.2 `WorklogEditModal`: pass the worklog's own `from` time as the anchor, so edits keep the recorded start; confirm it opens in Times mode.
- [x] 3.3 `WorklogEntry` (full-page manual entry): pass `fromDefault` as the anchor; disable Submit while a duration is invalid.
- [x] 3.4 `ClockOutModal`: pass `allowDuration={false}` so the clock-out flow stays Times-only (per the design non-goal).

## 4. Validation backstop

- [x] 4.1 Confirm the server-side same-day / positive-duration refinements in `worklogSchema.tsx` still reject an overflowed or zero duration if it slips past the UI, and add a test asserting this.

## 5. Verify

- [x] 5.1 Run `npm run test:ci` and `npm run lint`; add/adjust component tests for the toggle, duration save (new + edit), lunch-fold, and overflow rejection.
- [x] 5.2 Manually verify in the running app: new duration entry from default start, editing a lunch-subtracted entry into Duration mode preserves saldo, and an overflow attempt shows the error.
