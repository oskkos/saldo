## 1. Worklog validation

- [x] 1.1 Add `src/schemas/worklogSchema.tsx` — a Zod schema for `WorklogFormData`: `from`/`to` as dates refined so `to > from` AND both share the same UTC calendar day, optional `absence` constrained to the `AbsenceReason` set, and `comment` capped at 1000 characters.
- [x] 1.2 In `src/actions/index.ts`, validate input with the worklog schema at the start of `onWorklogSubmit` and `onWorklogEdit`; on failure throw an `Error` with a readable message before calling the repository.
- [x] 1.3 Add unit tests for the worklog schema covering: zero/negative duration rejected, unrecognized absence rejected, over-long comment rejected, and a valid worklog passing.

## 2. Settings validation

- [x] 2.1 Add `src/schemas/settingsSchema.tsx` — a Zod schema for `SettingsData`: required `beginDate`, default `from` before default `to`, `initialBalanceHours` as a bounded integer that MAY be negative (starting in deficit), and `initialBalanceMins` constrained to 0–59.
- [x] 2.2 In `src/actions/index.ts`, validate input with the settings schema at the start of `onSettingsUpdate`; on failure throw an `Error` with a readable message before calling the repository.
- [x] 2.3 Add unit tests for the settings schema covering: inverted times rejected, missing begin date rejected, out-of-range balance rejected, and a valid update passing.

## 3. Verify

- [x] 3.1 Run `npm run test:ci` and confirm all suites pass.
- [x] 3.2 Run `npm run lint` to confirm no lint/format regressions.
- [x] 3.3 Manually confirm the existing forms still show the validation errors via toast (no client-side regression).

## 4. Reconcile specs

- [x] 4.1 Remove the resolved "no server-side validation" open questions from `openspec/specs/worklog/spec.md` and `openspec/specs/settings/spec.md` (the new requirements are synced by `/opsx:archive`).
- [x] 4.2 Update the `statistics` spec's "negative/garbage spans flow through" open question to note it is now mitigated upstream by worklog validation.
