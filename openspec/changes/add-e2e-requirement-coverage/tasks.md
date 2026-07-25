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
- [ ] 6.4 (blocked) Cover creating an expected-hours override and its effect on the day's expectation, plus one override per date on re-save
- [ ] 6.5 Annotate both suites and confirm `settings` (5) and `expected-hours` (2) report end-to-end coverage

## 7. Absence end-to-end suite

- [ ] 7.1 Cover submitting a multi-day absence and assert one entry per day appears, all with the chosen reason and comment
- [ ] 7.2 Cover reason selection and the reason icon shown in the worklog list
- [ ] 7.3 Cover range normalization in the browser, in both directions
- [ ] 7.4 Annotate the suite and confirm `absence`'s 4 requirements report end-to-end coverage

## 8. Statistics end-to-end suite

- [ ] 8.1 Cover the statistics page rendering figures from seeded worklogs, with date-agnostic assertions
- [ ] 8.2 Cover absences being excluded from hours totals while appearing in the absence tally
- [ ] 8.3 Cover the per-day chart rendering, and the empty/no-settings state rendering nothing
- [ ] 8.4 Annotate the suite and confirm `statistics`' 6 journey requirements report end-to-end coverage

## 9. Exemption decisions

- [ ] 9.1 Write the `no-ui` exemptions (the coverage tool's own requirements, pool and duration configuration, row mapping, JWT internals)
- [ ] 9.2 Write the `unit-appropriate` exemptions (saldo arithmetic, the two timezone-invariance requirements)
- [ ] 9.3 Write the `external-dependency` exemption for OAuth sign-in
- [ ] 9.4 Write the `harness-cost` exemptions for the remaining auth requirements, each naming the suite that does cover it in `coveredAt`
- [ ] 9.5 Regenerate the map and confirm every requirement is either covered or exempt

## 10. Enable enforcement and document

- [ ] 10.1 Run `/opsx:sync` to promote the delta into `openspec/specs/`, so the new requirements are canonical before the gate is switched on
- [ ] 10.2 Annotate the tool's new Jest tests with the `spec-test-traceability` scenarios they assert
- [ ] 10.3 Add `no-ui` end-to-end exemptions for the capability's own new requirements
- [ ] 10.4 Turn on requirement-level enforcement under `--strict` and confirm `npm run spec:coverage:ci` passes with no workflow change
- [ ] 10.5 Document the requirement-level rule, the four categories and the `coveredAt` field in `CLAUDE.md` and `e2e/README.md`
- [ ] 10.6 Verify the branch tip is green: `npm run test:ci`, `npm run lint`, `npm run spec:coverage:ci`, and `npm run test:e2e`
