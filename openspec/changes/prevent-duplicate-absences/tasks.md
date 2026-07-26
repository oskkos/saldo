## 1. Conflict rule as pure logic

- [x] 1.1 Add a range-expansion helper to `src/services` turning a from/to pair into the inclusive list of `Date_ISODay` values, replacing the loop currently inlined in `absence.tsx`
- [x] 1.2 Add a conflict-message helper formatting a list of taken days with `toDayMonthYear` into `An absence is already recorded for 28.7.2026.`, naming at most three days and reporting the count of any remainder
- [x] 1.3 Unit-test both helpers: single day, multi-day range, one conflict, three conflicts, more than three (truncation and count), empty list
- [x] 1.4 Annotate the message tests with `@scenario absence/The message names the conflicting day` and `@scenario absence/Many taken days are summarized`

## 2. Repository guard and transactional insert

- [ ] 2.1 Add `getAbsenceDays(from, to)` to `worklogRepository.ts`: session-gated, filtered to the current user and to rows whose `absence` is set, wrapped in a Sentry span, returning the UTC calendar days already taken
- [ ] 2.2 Add `insertWorklogs(data[])` writing every record inside one `prisma.$transaction`
- [ ] 2.3 Guard `insertWorklog`: when `absence` is set, reject if that day is taken; return early with no extra query when it is not an absence
- [ ] 2.4 Guard `insertWorklogs`: check the whole batch in one lookup before opening the transaction, so a conflicting day means nothing is written
- [ ] 2.5 Guard `updateWorklog`: fire only when the **stored** record is an absence and the target day differs from its current day — moving a regular worklog onto an absence day must stay allowed, and self-collision cannot arise because a same-day edit is not a move
- [ ] 2.6 Unit-test the guards: same reason rejected, different reason rejected, nothing persisted on rejection, regular worklog onto an absence day allowed, absence moved onto a taken day rejected with neither record changed, batch rollback leaves no partial range
- [ ] 2.7 Annotate with `@scenario absence/Second absence with the same reason is rejected`, `@scenario absence/Second absence with a different reason is also rejected`, `@scenario absence/Moving an absence onto a taken day is rejected`, `@scenario absence/Moving a regular worklog onto an absence day is allowed`

## 3. Absence range action and `/absence` wiring

- [ ] 3.1 Add `AbsenceSchema` to `src/schemas`: from and to required, from not after to, reason one of the four, comment at most 1000 characters
- [ ] 3.2 Add an `onAbsenceSubmit` action validating with that schema, expanding the range, and delegating to `insertWorklogs`
- [ ] 3.3 Rewrite `absence.tsx` to call the action once, removing the per-day `Promise.all` and the `// TODO: Handle all in one call`; the existing catch already renders the thrown message in the error toast
- [ ] 3.4 Read settings in `absence/page.tsx` via `getSettings()` and pass `fromDefault`/`toDefault` into `Absence`, replacing the `NEW_WORKLOG_DEFAULT_*` constants used for the stored times
- [ ] 3.5 Unit-test the action: a range with one taken day persists nothing, a clean range persists every day, invalid input is rejected before any repository call
- [ ] 3.6 Unit-test that a submitted absence carries the user's configured default times rather than the module constants
- [ ] 3.7 Annotate with `@scenario absence/One taken day rejects the whole range` and `@scenario absence/Records use the user's configured default times`

## 4. Day view notice

- [ ] 4.1 Derive the notice in `worklogEntry.tsx` from the `wl` state already held, so it clears when the day's absence is deleted without a reload
- [ ] 4.2 Render it as an informational note above the inputs: an absence is recorded for this day, and hours logged here are still added to the saldo
- [ ] 4.3 Unit-test: shown on a day with an absence, absent on an ordinary day, gone after the absence is removed from the list
- [ ] 4.4 Annotate with `@scenario absence/Notice on an absence day`, `@scenario absence/No notice on an ordinary day`, `@scenario absence/Notice clears with the absence`

## 5. Calendar shows hours worked on an absence day

- [ ] 5.1 In `miniCalendar/util.tsx`, compute the day's regular-worklog total separately from the existing `calculateWorklogsSum` figure, which counts the absence's synthetic times and must keep feeding the border colouring unchanged
- [ ] 5.2 In `calendarCell.tsx`, show the reason icon and the hours together instead of the icon replacing the hours; a day with an absence and no regular worklogs still shows the icon alone
- [ ] 5.3 Unit-test: absence plus a 3-hour worklog shows both and the figure excludes the absence's own times, absence-only day shows the icon and no hours, ordinary day is unchanged
- [ ] 5.4 Annotate with `@scenario absence/Hours worked on an absence day stay visible` and `@scenario absence/An absence-only day shows no hours`

## 6. Saldo scenarios

- [ ] 6.1 Unit-test in `src/services/__tests__` that a holiday plus a 3-hour worklog on a 450-minute working day nets +180
- [ ] 6.2 Unit-test that a flex day plus a 3-hour worklog nets -270, and that an absence plus a 3-hour worklog on a Saturday nets +180
- [ ] 6.3 Annotate with `@scenario saldo/Work during a holiday raises the balance by the hours worked`, `@scenario saldo/Work during a flex day draws down only the unworked part`, `@scenario saldo/Work on an absence day that is not a working day`

## 7. End-to-end coverage

- [ ] 7.1 `e2e/absence.spec.ts`: seed an absence, submit a range covering that day, assert the warning names the day and that the stored worklog count is unchanged
- [ ] 7.2 `e2e/worklog.spec.ts`: on a seeded absence day, log hours, assert the success notification, that the absence row is still listed, and that the day notice is visible
- [ ] 7.3 `e2e/saldo.spec.ts`: assert the balance rises by the hours logged on an absence day
- [ ] 7.4 Assert on the month calendar that an absence day with logged hours shows both the icon and the hours
- [ ] 7.5 Confirm every touched spec imports `test` from `e2e/fixtures.ts`, not `@playwright/test`

## 8. Traceability and verification

- [ ] 8.1 Run `npm run spec:coverage` and commit the regenerated `openspec/COVERAGE.md`
- [ ] 8.2 Add a categorised `requirementsWithoutE2e` entry for any new requirement that ends up without a Playwright test, or confirm none is needed
- [ ] 8.3 Confirm each `@scenario` claim actually asserts that scenario's THEN, re-reading any annotation that spans layers
- [ ] 8.4 Run `npm run lint`, `npm run test:ci` and `npm run test:e2e` and confirm all three are green
