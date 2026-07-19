## Context

Three prior changes optimized the database on the theory that Neon cold-start was the initial-load bottleneck. A warm-load Sentry trace refuted the *warm-path* version of that theory: of ~6.9s, DB spans were ~1.5s (warm connects 100–270ms) and ~4–5s was uninstrumented CPU inside the render. The signal we missed earlier: the DB spans never summed to the request total.

Root cause, confirmed by local benchmark: `isHoliday()` (`src/util/date.ts`) does `new Holidays('FI')` **and** a per-call holiday computation each invocation (~1ms), and it is called once per day in `calculateCurrentSaldo`'s `beginDate → today` loop. `SaldoBadge` renders that on every route. So render cost is O(days) × ~1ms, worsened 3–5× by Vercel's throttled CPU, and grows by one iteration per calendar day.

Benchmark (local): per-year Set cache is 300–650× faster than per-call and ~1.5× faster than a bare singleton — effectively O(1) per day (2190 days: 2947ms → 9ms). `date-holidays`'s `getHolidays(year)` returns typed entries; `.isHoliday()` per-day is what's expensive.

## Goals / Non-Goals

**Goals:**
- Make saldo/holiday render cost O(distinct years), not O(days) — eliminating the multi-second warm-load CPU.
- Preserve holiday classification exactly (public-type, UTC day matching), guarded by existing tests.
- Revert the ineffective warm-up.
- Instrument the saldo computation so the fix is *proven* by the next trace, not assumed.

**Non-Goals:**
- Touching the DB layer further (the merged pool/cache/maxDuration stay; they help the separate cold-DB path).
- Changing saldo/expected-hours behavior — output must be byte-identical.

## Decisions

### Decision 1: Per-year public-holiday Set cache in `date.ts`
Module-level `const hd = new Holidays('FI')` plus a `Map<number, Set<Date_ISODay>>`. For a given date, resolve its year's Set (compute once via `hd.getHolidays(year)`, filter `type === 'public'`, map to `toISODay`), then `isHoliday = set.has(toISODay(date))`.

- **Why not just a singleton:** benchmark shows it's only ~1.4× — `.isHoliday()` itself is ~1ms/call, so it stays O(days). The Set cache removes the per-day computation entirely.
- **Semantics fidelity:** must reproduce today's `type === 'public'` filter and UTC day matching. `date.test.ts` locks specific dates including the moveable Midsummer boundary (2022-06-25 = true, 24/26 = false) and Christmas cluster — these are the acceptance guard for the refactor. If `getHolidays(year)`'s date strings resolve to a different calendar day than the old `.isHoliday(date)` at a boundary, a test fails and we adjust the day-key derivation.
- **Cache lifetime:** module scope, lives for the process/serverless-instance lifetime. Holiday rules for a given year are static, so no invalidation needed.

### Decision 2: Revert the warm-up entirely
Delete `src/repository/warmup.ts`, remove the import and the `await warmUpDb()` call in `src/app/layout.tsx`. It targeted DB connection latency (disproven) and is net-negative.

### Decision 3: Wrap `calculateCurrentSaldo` in a Sentry span
Add `Sentry.startSpan({ name: 'calculateCurrentSaldo', op: 'function' }, ...)` (or the nearest fit) so the post-deploy trace attributes this CPU directly. This is the discipline correction for having chased the wrong layer: the next trace must *show* the drop.

- **Note on the layer boundary:** `services/index.tsx` is documented as pure/side-effect-free. A tracing span is observability, not a side effect on the result, but it does import Sentry into services. Acceptable for attribution; alternatively wrap at the `SaldoBadge` call site to keep services pure. Implementation picks whichever keeps the service boundary cleanest — leaning toward the call site (`saldoBadge.tsx`) to avoid importing Sentry into pure services.

## Risks / Trade-offs

- **[Holiday-semantics drift in the refactor]** → The only real risk. Mitigated by the existing `date.test.ts` holiday assertions; keep them green (they must pass unchanged, not be edited to fit).
- **[Cross-year range spanning many years builds several Sets]** → Bounded by number of years (tiny); each `getHolidays(year)` is ~1ms once. Negligible.
- **[Span import into pure service layer]** → Avoided by wrapping at the call site if it muddies the boundary.

## Migration Plan

1. Add the per-year holiday Set cache; keep `isHoliday`/`isNonWorkingDay` signatures unchanged.
2. Revert warm-up (delete helper, remove layout call).
3. Add the saldo span.
4. `npm run test:ci` (holiday tests must pass unchanged) + `tsc` + lint.
5. Deploy; capture a warm-load trace and a forced-cold trace.
6. Confirm the saldo span is ~tens of ms and warm load ≈ ~1s; cold load also improved.
- **Rollback:** revert the `date.ts` cache (restores prior behavior); independent of other changes.

## Open Questions

- How far back is the production `beginDate`? It sets the loop size and thus the exact seconds saved — the trace will show it directly, so not a blocker.
