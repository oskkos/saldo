## 1. Cache holiday lookups per year

- [x] 1.1 In `src/util/date.ts`, construct `new Holidays('FI')` once at module scope and add a `Map<number, Set<Date_ISODay>>` cache. Add a helper that, for a given year, computes `getHolidays(year)` once, keeps only `type === 'public'`, and stores a `Set` of their UTC calendar days (`toISODay`).
- [x] 1.2 Rewrite `isHoliday(date)` to resolve the date's year Set and return `set.has(toISODay(date))`, preserving the exact current semantics (public-type only, UTC day). Keep `isHoliday`/`isNonWorkingDay` signatures unchanged.
- [x] 1.3 Confirm the existing `src/util/__tests__/date.test.ts` holiday assertions pass **unchanged** (New Year, Christmas Eve/Day/Boxing Day, Dec 31, and the Midsummer boundary 2022-06-24/25/26). Do not edit these tests to fit — they are the acceptance guard.

## 2. Revert the warm-up

- [x] 2.1 Delete `src/repository/warmup.ts`.
- [x] 2.2 In `src/app/layout.tsx`, remove the `warmUpDb` import and the `await warmUpDb()` call, restoring the prior session-gated flow.

## 3. Attribution instrumentation

- [ ] 3.1 Wrap the `calculateCurrentSaldo` invocation in a `Sentry.startSpan` so the post-deploy trace attributes this CPU directly. Prefer the call site (`src/components/saldoBadge.tsx`) to keep `src/services/index.tsx` free of Sentry imports; op `function`, name `calculateCurrentSaldo`.

## 4. Verify

- [ ] 4.1 Run `npm run test:ci`, `tsc --noEmit`, and lint on changed files; all holiday/saldo tests pass unchanged.
- [ ] 4.2 (local, optional) Re-run the benchmark shape against the new `isHoliday` to confirm O(1)/day behavior.

## 5. Post-deploy validation

- [ ] 5.1 After deploy, capture a warm-load trace and a forced-cold trace. Confirm the `calculateCurrentSaldo` span dropped from multi-second to ~tens of ms and warm load ≈ ~1s; cold load also improved (the CPU cost was present there too, masked by the slow DB). If the warm load is still multi-second with a small saldo span, there is additional uninstrumented render cost — investigate that next (e.g. `clientComponentLoading`), do not assume.
