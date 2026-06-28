## Why

`src/util/dateFormatter.ts` formats timestamps inconsistently: `toTime` and
`toDayMonthYear` use `dayjs.tz` (UTC), while seven other formatters
(`toDay`, `toISODay`, `toMonthAndYear`, `toWeek`, `toWeekday`, `toYearAndWeek`,
`toYearAndMonth`) use plain `dayjs(date)`, which formats in the runtime's local
timezone. The project's data model stores wall-clock values as UTC instants
(e.g. an entered `08:00` is stored `08:00Z`), so the correct way to read them
back is UTC. The local-time formatters therefore produce wrong results off-UTC:
day-bucketing in statistics, the mini-calendar, and worklog lists shifts near
UTC midnight, and a `00:00Z` value (e.g. `beginDate`) renders on the previous
day for users west of UTC. The bug is masked today because production runs in
UTC and the existing tests use a fixed TZ with boundary-avoiding fixtures.

## What Changes

- Normalize all formatters in `dateFormatter.ts` to read timestamps in UTC via
  `dayjs.utc(...)`, so the displayed value is always the stored wall-clock
  regardless of the runtime timezone.
- Convert `toTime` and `toDayMonthYear` from `dayjs.tz` to `dayjs.utc` as well,
  removing their hidden dependency on `dayjs.tz.setDefault('UTC')` being run
  first (it is set in `date.ts`, a load-order fragility).
- Harden the formatter tests: pin Jest to a non-UTC timezone and add
  midnight-crossing fixtures so any regression to local-time formatting fails.
- Affirm the design stance: timestamps are wall-clock-as-UTC and displayed
  verbatim; localizing to the viewer's browser timezone is an explicit non-goal.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `statistics`: Add a requirement that per-day grouping is timezone-independent
  (keyed on the UTC date), and resolve the `toISODay` open question now that the
  defect is fixed at the source rather than mitigated downstream.

## Impact

- **Code**: `src/util/dateFormatter.ts` (all formatters). No call sites change —
  the function signatures are unchanged; only the timezone they read in changes.
- **Tests**: `src/util/__tests__/dateFormatter.test.ts` (TZ pinning + boundary
  fixtures); `jest.setup.js` or jest config (fixed `TZ`).
- **Behavior**: correct output in any runtime timezone. No change in UTC
  production. Local dev (and any non-UTC runtime) stops mis-bucketing days.
- **Out of scope**: storing true UTC instants and localizing to the viewer's
  timezone (a separate, larger architectural model that was considered and
  rejected for this single-user app); `date.ts` (uses `tzWrapper` consistently,
  though `add()` is worth a glance during implementation).
