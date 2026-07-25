## 1. Coverage tool

- [x] 1.1 Add `scripts/spec-coverage.mjs` skeleton (plain ESM, `node:fs`/`node:path`/`node:crypto` only) with `--check` and `--strict` flag parsing, and confirm eslint accepts a `.mjs` Node script under the existing flat config (add an override only if it does not)
- [x] 1.2 Write failing Jest tests for the spec parser: scenario extraction as `<capability>/<title>`, requirement-independent IDs, duplicate-title-in-capability rejection
- [x] 1.3 Implement the spec parser over `openspec/specs/*/spec.md` to satisfy 1.2
- [x] 1.4 Write failing Jest tests for the content hash: 12-hex SHA-256 over the WHEN/THEN body, stable under whitespace-only edits, unchanged when only requirement prose changes
- [x] 1.5 Implement scenario hashing to satisfy 1.4
- [x] 1.6 Write failing Jest tests for the annotation scanner: single/stacked annotations, `describe`/`test.describe` inheritance, and hard errors with `file:line` for unattached annotations and non-literal test titles
- [x] 1.7 Implement the line-based annotation scanner over `src/**/__tests__/**` and `e2e/**` to satisfy 1.6
- [x] 1.8 Write failing Jest tests for exemption handling: wildcard expansion, unknown-scenario error, exempt-and-annotated error
- [x] 1.9 Implement exemption loading from `scripts/spec-coverage.exemptions.json` (created empty) to satisfy 1.8
- [x] 1.10 Write failing Jest tests for the map renderer and check mode: per-capability counts, covered rows with hash and test refs, uncovered list, exempt rows with reasons, `--check` writes nothing, stale map exits non-zero naming the regenerate command
- [x] 1.11 Implement map rendering to `openspec/COVERAGE.md` plus check mode to satisfy 1.10
- [x] 1.12 Add `spec:coverage` and `spec:coverage:ci` npm scripts; run the tool to produce the first map and record the authoritative gap list (do not wire CI yet)

## 2. Annotate existing tests

- [x] 2.1 Annotate `e2e/time-clock.spec.ts` from the traceability table currently in `e2e/README.md`
- [x] 2.2 Annotate `src/repository/__tests__/clockRepository.test.ts` for the time-clock scenarios covered at the data layer
- [x] 2.3 Annotate the remaining Jest tests (`src/services/`, `src/schemas/`, `src/components/`, `src/util/`) with the scenarios they already assert, claiming only scenarios whose THEN outcome is actually asserted
- [x] 2.4 Regenerate the map and confirm every annotation resolves (no unknown-scenario or unattached-annotation errors)

## 3. Exemptions

- [x] 3.1 Add the `user-guide-generation/*` wildcard exemption (Claude skill workflow; no app code path)
- [x] 3.2 Review the gap list from 1.12 and add per-scenario exemptions with written reasons for the remaining scenarios that no automated test can assert
- [x] 3.3 Regenerate the map and confirm every exemption resolves to a real, unannotated scenario

## 4. Close worklog and saldo gaps

- [x] 4.1 Write the missing tests for uncovered `worklog` scenarios and annotate them
- [x] 4.2 Write the missing tests for uncovered `saldo` scenarios and annotate them
- [x] 4.3 Regenerate the map and confirm both capabilities report zero uncovered scenarios

## 5. Close settings, expected-hours and absence gaps

- [x] 5.1 Write the missing tests for uncovered `settings` scenarios and annotate them
- [x] 5.2 Write the missing tests for uncovered `expected-hours` scenarios and annotate them
- [x] 5.3 Write the missing tests for uncovered `absence` scenarios and annotate them
- [x] 5.4 Regenerate the map and confirm all three capabilities report zero uncovered scenarios

## 6. Close auth, statistics and data-load-performance gaps

- [x] 6.1 Write tests for the `auth` scenarios (session gate, provider sign-in, signup/reset validation) and annotate them
- [x] 6.2 Write tests for the `statistics` scenarios and annotate them
- [x] 6.3 Write tests for the `data-load-performance` scenarios that are assertable without timing a real database, and exempt the rest with reasons
- [x] 6.4 Regenerate the map and confirm all three capabilities report zero uncovered scenarios

## 7. Self-coverage bootstrap

- [ ] 7.1 Run `/opsx:sync` to promote the `spec-test-traceability` delta into `openspec/specs/`, so the tool's own scenarios are canonical before the gate is switched on
- [ ] 7.2 Annotate the tool's Jest tests from group 1 with the `spec-test-traceability` scenarios they assert
- [ ] 7.3 Exempt the `spec-test-traceability` scenarios that are review- or CI-enforced rather than unit-testable (the over-claiming rule, the CI gate steps, the no-dependency rule) with written reasons
- [ ] 7.4 Regenerate the map and confirm the whole repository reports zero uncovered scenarios

## 8. CI gate and documentation

- [ ] 8.1 Add the `npm run spec:coverage:ci` step to the `build-and-test` job in `.github/workflows/build.yml`
- [ ] 8.2 Replace the hand-maintained traceability table in `e2e/README.md` with a pointer to `openspec/COVERAGE.md`
- [ ] 8.3 Document the annotation convention, the assert-the-THEN rule, and the regenerate command in `CLAUDE.md`
- [ ] 8.4 Verify the branch tip is green: `npm run test:ci`, `npm run lint`, `npm run spec:coverage:ci`, and `npm run test:e2e`
