## Why

`src/util/date.ts` computes date math in the runtime's local timezone — its
helpers (`startOfDay`, `endOfDay`, `startOfMonth`, `endOfMonth`, `daysInMonth`,
`now`, `add`, `subtract`, `isWeekend`) use plain `dayjs(date)` / `Date.getDay()`
rather than UTC. The app stores wall-clock values as UTC instants, so day
boundaries, weekdays, and arithmetic should be computed in UTC. The **saldo
calculation inherits this fragility** and produces wrong results on a non-UTC
runtime — a prototype showed the same scenario yield `0h 0min` under UTC but
`7h 30min` under `America/New_York` (a full working day mis-counted off the
`00:00Z` begin-date edge). This is masked in production (the Vercel server runs in
UTC) but is a latent bug recorded as a follow-up in the saldo spec. It is the
same class of defect already fixed in `dateFormatter.ts`.

## What Changes

- Normalize the read-side helpers in `date.ts` to UTC: replace local
  `dayjs(date)` with `dayjs.utc(date)` in `startOfDay`, `endOfDay`,
  `startOfMonth`, `endOfMonth`, `daysInMonth`, `add`, `subtract`; replace
  `Date.getDay()` with `Date.getUTCDay()` in `isWeekend`.
- Leave `now()` on its `keepLocalTime` behavior (current wall-clock as a UTC
  instant). Unlike the read helpers, `now()` *creates* a current wall-clock value
  — the same role as `toDate` — and is consumed only by the client mini-calendar
  to highlight the user's local "today". Switching it to `dayjs.utc()` would
  highlight the UTC day, which is wrong for non-UTC browsers near midnight.
- Leave the already-correct helpers unchanged: `diffInMinutes` (instant diff),
  `sameDay` (UTC), `timeIsGt` (string), `toDate` (intentional wall-clock-as-UTC),
  and `isHoliday` (the `date-holidays` library resolves Finnish holidays in the
  FI timezone independently of the runtime — verified by spike).
- Pin the Jest suite to a fixed non-UTC timezone (`America/New_York`) globally —
  now safe because the date utilities become timezone-independent — and convert
  the remaining timezone-fragile test fixtures (non-`Z` dates, `new Date(y,m,d)`)
  to explicit UTC. A green suite under the pin is the regression guard.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `saldo`: Add a requirement that the saldo calculation is timezone-independent
  (computed in UTC), and resolve the follow-up open question recording the
  `date.ts`/saldo timezone fragility.

## Impact

- **Code**: `src/util/date.ts` (the eight local helpers + `isWeekend`). Function
  signatures unchanged. The saldo calculation and everything else consuming these
  helpers gain timezone-independence with no API change.
- **Tests**: global Jest TZ pin (jest config); fixture conversions in
  `src/services/__tests__/index.test.tsx`, `src/util/__tests__/date.test.ts`, and
  any other suite that assumed a UTC runner.
- **Behavior**: **production (UTC) is provably unchanged** — under a UTC runtime
  `dayjs(date) ≡ dayjs.utc(date)`, so every swap is a no-op (demonstrated: the
  full suite stays green under `TZ=UTC` with the change applied). In non-UTC
  runtimes (local dev, any future non-UTC deploy) behavior changes from
  inconsistent to correct.
- **Out of scope**: the storage model (still wall-clock-as-UTC, displayed
  verbatim — multi-timezone localization remains a non-goal).
