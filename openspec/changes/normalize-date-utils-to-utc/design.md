## Context

The app's data model stores wall-clock values as UTC instants (`toDate` writes an
entered `08:00` as `08:00Z`). Reading them back correctly means computing in UTC.
`dateFormatter.ts` was normalized to UTC in a prior change; `date.ts` is the
remaining instance of the same bug. Its helpers compute in the runtime local
timezone, and the saldo calculation (`services/index.tsx`) depends on
`startOfDay`, `endOfDay`, `add`, and `isNonWorkingDay`, so the balance is
timezone-dependent. Production is UTC, so this never affects users today, but it
is a latent correctness bug and makes local development unreliable near day
boundaries.

## Goals / Non-Goals

**Goals:**
- Make `date.ts` (and therefore the saldo calc) compute in UTC, timezone-independent.
- Prove production behavior is unchanged.
- Land the global non-UTC test pin that was deferred from the `dateFormatter` change.

**Non-Goals:**
- Changing the storage model or entry path (`toDate` stays wall-clock-as-UTC).
- Viewer-localized display (store-true-UTC + localize was considered and rejected).
- Touching `isHoliday` / `date-holidays` behavior.

## Decisions

**Decision: `now()` keeps `keepLocalTime`; only the read helpers move to UTC.**
`now()` and `toDate` both *create* a current/entered wall-clock value as a UTC
instant (keepLocalTime) — they are a consistent pair. The read helpers
(`startOfDay`, `endOfDay`, `add`, …) instead *read* already-stored instants and
must do so in UTC. `now()` is consumed only by the client mini-calendar's
`sameDay(date, now())` "today" highlight, which must reflect the user's local
day; switching it to `dayjs.utc()` highlighted the UTC day and broke the
highlight for non-UTC browsers near midnight (caught by code review). So `now()`
is left unchanged; everything below applies to the read helpers only.

**Decision: Swap local `dayjs(date)` → `dayjs.utc(date)`; `getDay` → `getUTCDay`.**
Mechanical and minimal. The key safety property: **under a UTC runtime
`dayjs(date)` and `dayjs.utc(date)` are identical**, so every swap is a no-op in
production. This was demonstrated with a prototype:

| scenario | before | after |
|---|---|---|
| `TZ=UTC` (one scenario) | `0h 0min` | `0h 0min` (unchanged) |
| `TZ=America/New_York` | `7h 30min` (bug) | `0h 0min` (now == UTC) |
| full suite under `TZ=UTC` | 83 pass | 83 pass (no-op at scale) |

**Decision: `isHoliday` needs no change.** Spike result: `date-holidays`
(`new Holidays('FI')`) resolves Finnish holidays in the FI timezone, returning the
same result under `TZ=UTC` and `TZ=America/New_York`. It is runtime-timezone
independent.

**Decision: Global non-UTC Jest pin is now safe.** Once the utilities are
timezone-independent, pinning the whole suite to `America/New_York` (set before
process start, e.g. top of `jest.config.mjs` so workers inherit it) is safe, and a
green suite under the pin proves timezone-independence. This is the regression
guard the `dateFormatter` change could not have (a runtime `process.env.TZ` change
has no effect — Node caches the zone at startup).

**Decision: Convert timezone-fragile test fixtures to UTC.** Tests that use
non-`Z` date strings or `new Date(year, month, day)` (local constructor) shift
under a non-UTC pin even though the code is correct. Convert them to explicit UTC
(`new Date('...Z')`) so they are deterministic.

## Risks / Trade-offs

- [`now()` left on keepLocalTime while read helpers move to UTC — a deliberate
  asymmetry] → Correct: `now()` mirrors `toDate` (wall-clock creator), read
  helpers read stored instants. The client mini-calendar relies on `now()` being
  the user's local day. Documented in the `now()`/`tzWrapper` code comments.
- [`add`/`subtract` day/month arithmetic across DST differs between local and UTC]
  → UTC has no DST, which is the correct, stable behavior; UTC production is
  unaffected.
- [A fixture conversion could accidentally change a test's intent] → Convert only
  the date literal (same wall-clock, explicit `Z`); assertions stay the same, and
  the suite must pass under both `TZ=UTC` and the pinned `TZ`.

## Open Questions

- **`date-holidays` reasons in real Finnish time while the app uses
  wall-clock-as-UTC.** For the day-boundary use case these align (day instants are
  `00:00Z` → `02:00` Helsinki → same FI day), so it is not a blocker — but it is a
  conceptual seam. Leave as-is, or normalize how `isHoliday` is called? Default:
  leave as-is.
