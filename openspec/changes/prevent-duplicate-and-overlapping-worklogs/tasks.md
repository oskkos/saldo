## 1. Index the worklog table

- [x] 1.1 Add `@@index([user_id, from])` to the `Worklog` model in `prisma/schema.prisma`
- [x] 1.2 Generate the migration and run `prisma generate` so `src/generated/prisma` is current
- [ ] 1.3 Verify the migration applies cleanly against a fresh database and is additive only (no data change)
      — **not verifiable in this environment** (no local database; the configured
      `DATABASE_URL` is the hosted instance, which `prisma migrate dev` can reset on
      drift). The migration SQL was instead confirmed byte-identical to Prisma's own
      output via `prisma migrate diff --from-empty --to-schema`, and is a single
      additive `CREATE INDEX`. Needs one run against a fresh database before merge.

## 2. Detect overlapping work entries in the repository

- [x] 2.1 Add a `WorklogOverlapError` to `src/services/index.tsx` beside `AbsenceConflictError`, carrying the conflicting spans so the message can name them
- [x] 2.2 Add a pure overlap predicate to `src/services/index.tsx` using half-open comparison (`a.from < b.to && b.from < a.to`), with unit tests covering identical, partial, touching, and disjoint spans
- [x] 2.3 Add `overlappingWorkEntries(userId, from, to, excludeId?)` to `src/repository/worklogRepository.ts`, querying `from < to` / `to > from` with `absence: null` and the current user, excluding `excludeId` when given
- [x] 2.4 Call the guard from `insertWorklog`, skipping it entirely when the incoming entry carries an `absence`, and bypassing it when the new `allowOverlap` option is set
- [x] 2.5 Call the guard from `updateWorklog`, excluding the edited row from its own comparison, with the same `allowOverlap` bypass
- [x] 2.6 Extend `src/repository/__tests__/worklogRepository.test.ts`: conflict on identical span, conflict on partial overlap, no conflict on touching spans, stored absence not reported, incoming absence not checked, edit excludes itself, edit onto an occupied span conflicts, `allowOverlap` persists
- [x] 2.7 Annotate the new tests with their `// @scenario worklog/...` coverage declarations

## 3. Make clock-out idempotent

- [x] 3.1 In `src/repository/clockRepository.ts`, make `clockOutWithWorklog` close the session conditionally on `started_at` being non-null and create the worklog only when that update affected a row, mirroring `clockIn`
- [x] 3.2 Have it report to the caller whether a session was actually finalized, so a repeat is distinguishable from a first finalize
- [x] 3.3 Apply the same overlap guard and `allowOverlap` bypass to the worklog it creates
- [x] 3.4 Extend `src/repository/__tests__/clockRepository.test.ts`: repeated finalize creates no second worklog, concurrent finalize creates one, finalizing an open session still works
- [x] 3.5 Annotate the new tests with their `// @scenario time-clock/...` coverage declarations

## 4. Return worklog outcomes as values

- [x] 4.1 Add the result and conflict types to `src/types/index.ts`, mirroring the shape of `AbsenceSubmitResult` with a `conflict` variant carrying the overlapping spans
- [x] 4.2 Change `onWorklogSubmit` in `src/actions/index.ts` to validate with `safeParse`, catch `WorklogOverlapError`, and return success / conflict / error instead of throwing; accept an `allowOverlap` argument
- [x] 4.3 Do the same for `onWorklogEdit`
- [x] 4.4 Do the same for `onClockOut`, returning a distinct outcome when no session was open to finalize
- [x] 4.5 Leave `validateOrThrow` and the non-worklog actions (settings, expected-hours overrides) unchanged
- [x] 4.6 Update the four consumers (`worklogEntry`, `quickAddModal`, `worklogEditModal`, `clockOutModal`) to unwrap the result and surface the error message, without the confirmation flow yet
- [x] 4.7 Extend `src/actions/__tests__/worklogActions.test.ts`: success carries the record, conflict is returned rather than thrown, validation rejections are returned with a readable message
- [x] 4.8 Annotate the new tests with their `// @scenario worklog/...` coverage declarations

## 5. Let a modal survive its confirm action

- [x] 5.1 In `src/components/modal.tsx`, give the confirm button `type="button"` so activating it no longer dismisses the dialog implicitly
- [x] 5.2 Expose an explicit close so callers dismiss the dialog when their action reports success
- [x] 5.3 Update `quickAddModal`, `worklogEditModal`, `worklogDeleteConfirm` and `clockOutModal` to close explicitly on success and stay open otherwise
- [x] 5.4 Update `src/components/__tests__/` coverage for the modal and each of the four callers: the dialog stays open on a failed action and closes on a successful one

## 6. Guard against re-entrant submissions

- [x] 6.1 Rework `src/util/useTransitionWrapper.ts` to hold a synchronous `busyRef`, return `[busy, run]`, and have `run` resolve to `false` without invoking the action when a call is already in flight
- [x] 6.2 Release the guard in a `finally` so a failed action does not leave the control permanently inert, and keep `router.refresh()` inside `startTransition`
- [x] 6.3 Add `src/util/__tests__/useTransitionWrapper.test.ts`: a second call during flight is dropped and resolves `false`, two calls in the same tick run the action once, the guard releases after success and after failure
- [x] 6.4 Update all ten consumers to destructure `busy` and pass it to their control's disabled state, combining it with any existing validity gate
- [x] 6.5 Update every notifying call site to gate its success toast on `run`'s result, so a dropped call reports nothing
- [x] 6.6 Extend the component tests for the notifying paths: a dropped submission shows no toast and does not alter the rendered list
- [x] 6.7 Annotate the new tests with their `// @scenario mutation-safety/...` coverage declarations

## 7. Confirm an overlap before saving it

- [x] 7.1 Add a shared helper that turns a conflict result into a `window.confirm` prompt naming the overlapping span, matching the phrasing already used for the discard confirmation
- [x] 7.2 Wire the confirm-and-resubmit flow into `worklogEntry`, re-calling the action with `allowOverlap` on confirmation and doing nothing on decline
- [x] 7.3 Wire it into `quickAddModal` and `worklogEditModal`, keeping the modal open when the user declines so their input is not lost
- [x] 7.4 Wire it into `clockOutModal`, leaving the session open and the modal usable when the user declines
- [x] 7.5 Ensure the resubmission is itself covered by the re-entrancy guard
- [x] 7.6 Extend the component tests: conflict prompts, confirming persists, declining writes nothing and preserves input, declining at clock-out leaves the session open
- [x] 7.7 Annotate the new tests with their `// @scenario worklog/...` and `// @scenario time-clock/...` coverage declarations

## 8. Cover the flows end to end

- [ ] 8.1 Add a Playwright spec for the overlap confirmation on the worklog entry page (prompt shown, confirm saves, decline saves nothing), taking `test` from `e2e/fixtures.ts`
- [ ] 8.2 Add a Playwright spec asserting a rapid double activation of Submit creates exactly one entry
- [ ] 8.3 Annotate the e2e specs with their scenario declarations and confirm every scenario in the four delta specs is claimed or has a recorded exemption
- [ ] 8.4 Run `npm run test:ci` and `npm run lint` and resolve anything they surface

## 9. Update the documentation

- [ ] 9.1 Update `docs/architecture.md` for the new repository-level invariant, the action result contract, and the Prisma index
- [ ] 9.2 Note the re-entrancy guard convention where `docs/architecture.md` describes the client-to-action boundary, so future call sites follow it
- [ ] 9.3 Regenerate the user guide with `/generate-user-guides` for the new overlap confirmation
- [ ] 9.4 Review `CLAUDE.md`, `docs/testing.md`, `docs/getting-started.md` and `README.md` and record explicitly which were checked and why any needed no change
