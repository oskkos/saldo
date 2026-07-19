## Why

The previous change (`fix-slow-initial-db-load`: pool `max:10`, per-request `cache()` dedup, `Promise.all`, `maxDuration`) shipped, but a forced-cold post-deploy trace showed **no improvement** — the initial load was still ~8.6s. A spike settled why:

- Through the **exact** app stack (`PrismaPg` + `pg.Pool({ max: 10 })`), three independent reads run **concurrently** — `Promise.all` of `pg_sleep(0.5)` completed in ~0.58s, not ~1.5s. Our code is not the bottleneck; it parallelizes correctly.
- The slowness is entirely **Neon scale-to-zero cold start**. When the compute is asleep, the page's ~4 reads fire as a concurrent burst against a cold compute, and Neon serializes new backend-connection establishment at ~1s each → ~4.8s of stacked connect latency. Prior traces confirm that once the compute is warm, connections/reads are cheap (~100ms, one reused at 1ms).

Keep-warm (pinging to prevent scale-to-zero) would fix it but does **not fit the 100 CU-hr/month Neon budget** — even a 12h/day warm window costs ~90 CU-hrs with near-zero headroom, and 24/7 is ~180. So instead of *preventing* the cold start, we make it **cheap**: pay the compute wake **once** per request, then let the already-parallel reads run against a warm compute.

## What Changes

- **Warm the database compute once, before the concurrent reads.** Issue a single lightweight query (e.g. `SELECT 1`) at the start of the root layout render (which runs on every authenticated route, ahead of the layout/page/badge reads), and `await` it before the existing `Promise.all` reads. On a cold start this pays the ~1s wake a single time; the subsequent reads then hit a warm compute and overlap (~0.5s), turning ~8.6s into ~1.5s.
- **Negligible warm-path cost.** When the compute is already awake, the warm-up is a ~20ms round-trip, so steady-state loads are effectively unchanged.
- Gated on session presence, matching the existing layout reads (an unauthenticated request redirects and does no DB work, so nothing to warm).

Explicitly **out of scope** (unchanged from the prior decision):
- Keep-warm / autosuspend tuning — does not fit the 100 CU-hr budget.
- `@neondatabase/serverless` driver swap — the spike proved the stack already parallelizes warm, so there is no connection-concurrency problem for the driver to solve.

## Capabilities

### New Capabilities
<!-- None. -->

### Modified Capabilities
- `data-load-performance`: add a requirement that the app warms the database compute once per request, before issuing its concurrent reads, so a cold start is paid a single time rather than once per concurrent connection.

## Impact

- **Code:** `src/app/layout.tsx` (add the awaited warm-up ahead of the session-gated `Promise.all`), plus a small warm-up helper in `src/repository/` (`server-only`, wrapping a trivial query in a `Sentry.startSpan` for trace visibility).
- **No dependency, schema, or API changes.** Builds on the already-merged `fix-slow-initial-db-load` work (the parallel reads it makes fast).
- **Validation:** capture a forced-cold Sentry trace (idle past Neon autosuspend, then load `/`) and confirm ~8.6s → ~1.5s, with a single ~1s warm-up span followed by overlapping (not serialized) reads.
- **Risk:** the warm-up adds one serial round-trip to every request (negligible warm). The cold-path win rests on Neon's "first query wakes the compute, subsequent queries are warm" model — supported by the prior traces' fast warm tail — but is only fully confirmed by the post-deploy cold trace.
