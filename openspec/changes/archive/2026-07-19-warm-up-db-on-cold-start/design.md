## Context

`fix-slow-initial-db-load` shipped pool widening, per-request `cache()` dedup, `Promise.all`, and `maxDuration`, but a forced-cold trace showed the initial load unchanged at ~8.6s. Two pieces of evidence reframed the problem:

- **Spike (local, warm DB):** through the exact `PrismaPg` + `pg.Pool({ max: 10 })` stack, `Promise.all` of three `pg_sleep(0.5)` reads finished in ~0.58s (concurrent), vs ~1.51s serial. The application stack parallelizes correctly — it is not the bottleneck.
- **Cold trace + prior warm tails:** the cost is Neon scale-to-zero. A concurrent burst of ~4 reads against a *cold* compute serializes at ~1s/connection (~4.8s). Once warm, the same connections are cheap (~100ms, one reused at 1ms in an earlier trace).

Constraint: the Neon budget is **100 compute-hours/month**, which rules out keep-warm (a 12h/day warm window ≈ 90 CU-hrs with no headroom; 24/7 ≈ 180).

The problem decomposes as `serial × cold`. We already addressed the concurrency axis; the remaining lever that fits the budget is to stop paying the cold cost *per connection* and pay it *once*.

## Goals / Non-Goals

**Goals:**
- Bring the cold initial load from ~8.6s to ~1.5s, under Vercel's function-kill line, at ~zero extra compute cost.
- Pay the Neon compute wake once per request, then let the already-parallel reads run warm.
- Keep the change minimal, in-code, and easily reverted.

**Non-Goals:**
- Preventing cold starts (keep-warm) — does not fit the 100 CU-hr budget.
- Swapping to `@neondatabase/serverless` — the spike proved the stack parallelizes warm; there is no concurrency defect for it to fix.
- Any change to domain behavior, schema, or the saldo calculation.

## Decisions

### Decision 1: A single awaited warm-up query at the start of the root layout
The root layout (`src/app/layout.tsx`) renders on every authenticated route and is the first place that touches the database (its session-gated `Promise.all`). Awaiting one trivial query (`SELECT 1`) *before* that `Promise.all` wakes the compute once; the subsequent reads (layout `Promise.all`, the saldo badge's overrides, the page's reads) then hit a warm compute and overlap.

- **Why serial-then-parallel:** the cold cost is the compute wake. If the reads fire as a concurrent burst against a cold compute, each connection independently races the wake and Neon serializes them. Forcing a single wake first, then releasing the parallel reads, converts `N × cold-connect` into `1 × wake + N × warm-parallel`.
- **Gating:** run the warm-up only when a session exists, mirroring the existing reads — an unauthenticated request redirects and does no DB work.

### Decision 2: Warm-up lives behind a small `server-only` repository helper
Add e.g. `warmUpDb()` in `src/repository/` that runs `prisma.$queryRaw\`SELECT 1\`` wrapped in a `Sentry.startSpan` (op `db.sql.prisma`, name `warmUpDb`) so the wake is visible in traces and the validation step can confirm the single-wake shape. Keeps the raw query out of the layout and consistent with the repository boundary (all DB access wrapped in spans).

- **Alternative — inline `prisma.$queryRaw` in the layout:** leaks a raw query past the repository boundary and gives no span; rejected.
- **Alternative — reuse an existing read as the "warm-up":** e.g. `await getSettings()` first, then `Promise.all` the rest. Works, but couples warm-up to a specific read, muddies the layout, and one of the reads (settings) can be `null`; an explicit dedicated warm-up is clearer and cheaper.

### Decision 3: No error-swallowing; warm-up failures surface normally
If the warm-up query throws (DB genuinely unreachable), let it propagate like any other read failure rather than catching and continuing — a failed warm-up means the reads would fail too. No new error path.

## Risks / Trade-offs

- **[The warm-up adds one serial round-trip to every request]** → Negligible when warm (~20ms); the cold-path win (~7s) dwarfs it. It is the intended trade.
- **[Relies on Neon's "first query wakes, then warm" behavior]** → This is fundamental Neon scale-to-zero semantics and is supported by the prior traces' fast warm tail, but the cold-path result is only fully confirmed by a post-deploy forced-cold trace. This is a far smaller assumption than the prior concurrency bet, which is why we validate rather than pre-assume.
- **[If cold connection cost persists even after wake]** → then warm-up won't fully help and the residual points back to a paid Neon plan (extend autosuspend). The forced-cold trace will show this; the change is trivially revertible.
- **[Double-counting: does warm-up + first real read pay the wake twice?]** → No — once the compute is awake it stays active until autosuspend; only the warm-up pays the wake, the reads that follow are warm.

## Migration Plan

1. Add `warmUpDb()` helper and await it (session-gated) before the layout's `Promise.all`.
2. `npm run test:ci` + `npm run lint` + `tsc --noEmit`.
3. Deploy; idle past Neon autosuspend; load `/`; capture the cold Sentry trace.
4. Confirm ~8.6s → ~1.5s with a single ~1s `warmUpDb` span followed by overlapping reads.
- **Rollback:** remove the awaited warm-up call; pure addition, no dependency on other changes.

## Open Questions

- Exact warm-path overhead of the extra round-trip on the pooled endpoint (expected ~10–30ms) — confirmed by the same post-deploy trace.
