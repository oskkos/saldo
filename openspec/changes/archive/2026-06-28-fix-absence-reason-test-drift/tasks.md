## 1. Correct the drifted tests

- [x] 1.1 In `src/services/__tests__/index.test.tsx`, replace the two `absence: 'vacation'` worklog fixtures (and their `// ... vacation` comments) with `absence: 'holiday'`, keeping the same expected saldo results.
- [x] 1.2 In the same file, update the `absenceReasonToString` test: replace the input list `['sick_leave', 'vacation', 'unpaid_leave', 'flex_hours', 'other']` with the canonical set `['holiday', 'flex_hours', 'sick_leave', 'other']` and update the expected output to `['Holiday', 'Flex hours', 'Sick leave', 'Other']`.
- [x] 1.3 Grep the repo to confirm `vacation` and `unpaid_leave` no longer appear anywhere (`grep -rn "vacation\|unpaid_leave" src/`).

## 2. Verify

- [x] 2.1 Run `npm run test:ci` and confirm all suites pass.
- [x] 2.2 Run `npm run lint` to confirm no lint/format regressions.

## 3. Reconcile specs

- [x] 3.1 Remove the resolved reason-drift open question from `openspec/specs/absence/spec.md`. (The clarified reason-set requirement is synced by `/opsx:archive`, not by hand.)
- [x] 3.2 Remove the now-resolved absence-reason-drift open question from `openspec/specs/saldo/spec.md`.
