## 1. Recognize aliased test imports

- [x] 1.1 Write failing Jest tests for the scanner: a test declared via `import { test as setup } from '@playwright/test'` is recognized, an aliased `it`/`describe` is recognized, and an unrelated local named `setup` without the import is not
- [x] 1.2 Collect local aliases from the file's import declarations and treat them as test openers, keeping the scanner line-based
- [x] 1.3 Annotate `e2e/auth.setup.ts` with `auth/Email/password sign-in`, regenerate the map, and confirm the scenario resolves

## 2. Requirement-level analysis, report-only

- [x] 2.1 Write failing Jest tests for requirement identity: `<capability>/<Requirement name>`, and duplicate requirement names within a capability rejected
- [x] 2.2 Implement requirement extraction to satisfy 2.1
- [x] 2.3 Write failing Jest tests for layer derivation: a scenario covered by a test under `e2e/` marks its requirement as end-to-end covered, a unit-only requirement does not, and a requirement whose scenarios are all exempt needs no decision
- [x] 2.4 Implement layer derivation from the covering test's path to satisfy 2.3
- [x] 2.5 Write failing Jest tests for the map's end-to-end section: per-capability counts, the list of requirements lacking coverage, category and reason per exempt requirement
- [x] 2.6 Render the end-to-end dimension into `openspec/COVERAGE.md`; regenerate and record the authoritative gap list (no enforcement yet)

## 3. Categorised end-to-end exemptions

- [x] 3.1 Write failing Jest tests for the new exemptions file shape: `scenarios` and `requirementsWithoutE2e` top-level keys, with the existing scenario behaviour unchanged
- [x] 3.2 Migrate `scripts/spec-coverage.exemptions.json` to the keyed shape and update loading to satisfy 3.1
- [x] 3.3 Write failing Jest tests for category validation: the four categories accepted, an unknown category rejected, a missing or blank reason rejected
- [x] 3.4 Write failing Jest tests for `coveredAt`: required for `harness-cost`, rejected when the named file does not exist, not required for other categories
- [x] 3.5 Write failing Jest tests for the rot rules: unknown requirement rejected, renamed requirement reported with its old identifier, exemption superseded by real end-to-end coverage rejected
- [x] 3.6 Implement category, `coveredAt` and rot validation to satisfy 3.3–3.5

## 4. End-to-end harness

- [x] 4.1 Add `db.ts` helpers to seed and clear worklogs for the test user, including absences and lunch-break flags
- [x] 4.2 Add `db.ts` helpers to set and reset settings (begin date, initial balance, default times, expected minutes) and expected-hours overrides
- [x] 4.3 Add a per-test reset that clears worklogs, overrides and settings back to a known baseline, in the shape `resetClockState` already establishes
- [x] 4.4 Confirm the existing 9 time-clock tests still pass against the new reset

## 5. Worklog end-to-end suite

- [x] 5.1 Cover creating a worklog through the form: entry appears in the list and the saldo badge moves by the entered amount
- [x] 5.2 Cover editing an existing worklog and deleting one, asserting the list and badge afterwards
- [x] 5.3 Cover the duration mode journey end to end: net time, the default-start anchor, and rejection of an overflow past midnight
- [x] 5.4 Cover server-side rejection surfacing in the UI for an invalid worklog, and that nothing is added to the list
- [x] 5.5 Annotate the suite and confirm `worklog`'s 8 journey requirements report end-to-end coverage

## 6. Settings and expected-hours end-to-end suites

- [x] 6.1 Cover saving settings and reading them back after a reload
- [x] 6.2 Cover a settings change moving the saldo, asserted as a relationship rather than an absolute figure
- [x] 6.3 Cover rejection of inverted default times surfacing in the UI, with the stored settings unchanged
- [x] 6.4 Exempt both `expected-hours` requirements as `harness-cost`: the "Special days" panel is a daisyUI `<details>` collapse whose fields never become visible to Playwright, so the override journey cannot be driven without reworking the component
- [x] 6.5 Annotate the settings suite and confirm `settings` reports 5 end-to-end covered and `expected-hours` 2 exempt

## 7. Absence end-to-end suite

- [x] 7.1 Cover submitting a multi-day absence and assert one entry per day appears, all with the chosen reason and comment
- [x] 7.2 Cover reason selection and the reason icon shown in the worklog list
- [x] 7.3 Cover range normalization in the browser, in both directions
- [x] 7.4 Annotate the suite and confirm `absence`'s 4 requirements report end-to-end coverage

## 8. Statistics end-to-end suite

- [x] 8.1 Cover the statistics page rendering figures from seeded worklogs, with date-agnostic assertions
- [x] 8.2 Cover absences being excluded from hours totals while appearing in the absence tally
- [x] 8.3 Cover the per-day chart rendering, and the empty/no-settings state rendering nothing
- [x] 8.4 Annotate the suite and confirm `statistics`' 6 journey requirements report end-to-end coverage

## 9. Saldo end-to-end suite

Not in the original plan, which assumed the whole saldo capability was
unit-appropriate. It is not: most of it is observable in the badge, and a
comparison of two begin dates isolates a single day's contribution without
needing control of the server clock.

- [x] 9.1 Add a day-contribution helper that reads the badge with and without a day in the accrual window, so the expected side of a scenario can be asserted and not just the worked side
- [x] 9.2 Cover the worked-minutes rules: initial balance, lunch break both ways, work on a Sunday, and the begin-date and future-entry exclusions
- [x] 9.3 Cover the absence rules: flex draws down a full day, non-flex is balance-neutral, and any absence on a non-working day is ignored
- [x] 9.4 Cover expectation accrual and overrides, taking `expected-hours/Expected minutes are resolved per date` to end-to-end coverage and dropping its exemption
- [x] 9.5 Cover badge styling by sign and the day-total aggregation, and confirm `saldo` reports 11 of 13 requirements end-to-end covered

## 10. Exemption decisions

- [x] 10.1 Write the `no-ui` exemptions (the coverage tool's own requirements, pool and duration configuration, row mapping, JWT internals)
- [x] 10.2 Write the `unit-appropriate` exemptions (the two timezone-invariance requirements and the saldo worked example, now that the rest of saldo is covered)
- [x] 10.3 Write the `external-dependency` exemption for OAuth sign-in
- [x] 10.4 Write the `harness-cost` exemptions for the remaining auth requirements, each naming the suite that does cover it in `coveredAt`
- [x] 10.5 Regenerate the map and confirm every requirement is either covered or exempt

## 11. Enable enforcement and document

- [x] 11.1 Sync the delta into `openspec/specs/`, so the new requirements are canonical before the gate is switched on
- [x] 11.2 Annotate the tool's new Jest tests with the `spec-test-traceability` scenarios they assert
- [x] 11.3 Add `no-ui` end-to-end exemptions for the capability's own new requirements
- [x] 11.4 Turn on requirement-level enforcement under `--strict` and confirm `npm run spec:coverage:ci` passes with no workflow change
- [x] 11.5 Document the requirement-level rule, the four categories and the `coveredAt` field in `CLAUDE.md` and `e2e/README.md`
- [x] 11.6 Verify the branch tip is green: `npm run test:ci`, `npm run lint`, `npm run spec:coverage:ci`, and `npm run test:e2e`
