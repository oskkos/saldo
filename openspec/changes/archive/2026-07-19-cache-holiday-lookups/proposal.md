## Why

The initial-load investigation chased the database through three changes (pool `max:10`, `cache()` dedup, `Promise.all`, `maxDuration`, then a warm-up query). A **warm-load** trace finally exposed the real cost: of a ~6.9s request, the DB spans summed to only ~1.5s (connects 100–270ms — fine warm), while **~4–5s sat inside the render with no DB span at all**. That gap is CPU, not I/O.

The culprit is `isHoliday()` in `src/util/date.ts`:

```
isHoliday(date) { const h = new Holidays('FI'); return h.isHoliday(date)... }
```

It constructs a fresh `date-holidays` instance **and** does a per-call holiday computation (~1ms each) **once per day** in the `beginDate → today` loop of `calculateCurrentSaldo` — which `SaldoBadge` renders on **every route**. That is O(days) with a ~1ms constant, amplified 3–5× by Vercel's throttled serverless CPU, and it is a **scaling bug**: the loop grows by one iteration every day the app runs.

Benchmarks (local; Vercel is several× slower):

| days | per-call (current) | module singleton | per-year Set cache |
|------|-------------------|------------------|--------------------|
| 365  | 594 ms | 363 ms | **2 ms** |
| 1095 | 1465 ms | 1113 ms | **5 ms** |
| 2190 | 2947 ms | 2136 ms | **9 ms** |

A module-level singleton is only ~1.4× (still O(days) at ~1ms/day). A **per-year Set cache** is 300–650× — effectively O(1) per day. The prior warm-up query (`warmUpDb`) targeted DB connection latency and was disproven by the trace; it is net-negative (adds its own ~1s cold connect) and must be reverted.

## What Changes

- **Cache holiday lookups per year.** In `src/util/date.ts`, construct `new Holidays('FI')` once at module scope and memoize each year's **public** holidays as a `Set` of calendar days; `isHoliday(date)` becomes a `Set.has(toISODay(date))`. Preserves the existing semantics exactly (`type === 'public'`, UTC day matching) — guarded by the existing `date.test.ts` holiday assertions (incl. the moveable Midsummer boundary).
- **Revert the warm-up.** Remove `warmUpDb()` and its call in `src/app/layout.tsx`, and delete `src/repository/warmup.ts`. It addressed the wrong layer and is net-negative.
- **Add attribution instrumentation.** Wrap `calculateCurrentSaldo` in a `Sentry.startSpan` so the post-deploy trace *proves* the saldo/holiday CPU dropped, rather than us inferring it.

Keep the already-merged `max:10` / `cache()` / `maxDuration` — they legitimately help the separate, smaller cold-DB path.

## Capabilities

### New Capabilities
<!-- None. -->

### Modified Capabilities
- `data-load-performance`: **remove** the warm-up-compute requirement (its implementation is being reverted as ineffective), and **add** a requirement that expensive per-day computations over a date range (holiday lookups) are cached so render cost is bounded by the number of distinct years, not the number of days.

## Impact

- **Code:** `src/util/date.ts` (holiday cache), `src/app/layout.tsx` (remove warm-up call), delete `src/repository/warmup.ts`, `src/services/index.tsx` (span around `calculateCurrentSaldo`).
- **No dependency/schema/API changes.** Output is byte-identical (pure perf refactor); existing tests guard it.
- **Validation:** post-deploy warm-load trace — confirm the saldo span drops from multi-second to ~tens of ms and the warm load falls to ~1s. Cold load should also drop (the CPU cost was present there too, masked by the slow DB).
- **Risk:** low — the only behavioral risk is holiday-semantics drift in the refactor, and `date.test.ts` locks the exact dates (New Year, Christmas Eve/Day/Boxing, Dec 31, Midsummer boundary).
