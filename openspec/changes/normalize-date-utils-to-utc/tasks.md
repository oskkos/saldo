## 1. Normalize date.ts to UTC

- [x] 1.1 In `src/util/date.ts`, swap local `dayjs(date)` for `dayjs.utc(date)` in `startOfDay`, `endOfDay`, `startOfMonth`, `endOfMonth`, and `daysInMonth`. NOTE: `now()` was intentionally left on `keepLocalTime` (it creates a current wall-clock value like `toDate`; the client mini-calendar needs the user's local "today"). Code review caught that swapping it broke the today-highlight for non-UTC browsers.
- [x] 1.2 Swap `add` and `subtract` to `dayjs.utc(d)` (both the Date and string-input branches).
- [x] 1.3 Change `isWeekend` to use `date.getUTCDay()` instead of `date.getDay()`.
- [x] 1.4 Confirm `diffInMinutes`, `sameDay`, `timeIsGt`, `toDate`, and `isHoliday` are left unchanged (already timezone-safe). Remove `tzWrapper` if it becomes unused.

## 2. Pin the test timezone and de-fragilize fixtures

- [x] 2.1 Set a global non-UTC Jest timezone before workers start (e.g. `process.env.TZ = 'America/New_York'` at the top of `jest.config.mjs`).
- [x] 2.2 Convert timezone-fragile fixtures to explicit UTC: non-`Z` date strings and `new Date(year, month, day)` constructors in `src/services/__tests__/index.test.tsx`, `src/util/__tests__/date.test.ts`, and any other suite that fails under the pin. Keep the intended wall-clock; only make the timezone explicit.
- [x] 2.3 Add a saldo test asserting the same result for a begin-date-at-UTC-midnight scenario, which would differ under the old local-time math.

## 3. Verify

- [x] 3.1 Run `npm run test:ci` under the pinned timezone and confirm all suites pass (this is the timezone-independence guard).
- [x] 3.2 Confirm production-invariance: the full suite also passes under `TZ=UTC` (every swap is a no-op there).
- [x] 3.3 Run `npm run lint`.

## 4. Reconcile specs

- [x] 4.1 Remove the resolved `date.ts`/saldo timezone-fragility open question from `openspec/specs/saldo/spec.md` (the new requirement is synced by `/opsx:archive`).
