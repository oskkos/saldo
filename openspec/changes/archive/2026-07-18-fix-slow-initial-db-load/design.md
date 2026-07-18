## Context

The home route `GET /` intermittently times out on Vercel. Two Sentry traces of the route establish the mechanism:

| Trace | Total | Dominant cost | Notes |
|-------|-------|---------------|-------|
| Jun 29 | 9.96s | `pg-pool.connect` 1–2s, repeated per query | pre-`cache()` |
| Recent | 7.96s | first-touch cold `SELECT`s ~1.4s each (Worklog/Settings/User) | `getActiveSession` `cache()` live; connect only 281ms |

Both sit on Vercel's ~10s function-kill line. Requests that exceed 10s are terminated **before** Sentry flushes the transaction, so the true timeouts leave no trace — the surviving near-misses are the evidence, and their absence-of-errors is itself consistent with hard kills.

The root cause is Neon **scale-to-zero**: after idle, the compute suspends; the first request must wake it and warm a cold page cache, so the first touch of each table pays pageserver-fetch latency (~1.4s). The *fatal* amplifier is that this cold work is forced **single-file** by three compounding factors:

1. `src/repository/prisma.ts` uses `new Pool({ max: 1 })` — even `Promise.all` reads serialize at the pool.
2. `src/app/(calendar)/page.tsx` awaits its four reads sequentially.
3. The root layout (Navbar) and the page each read `getSettings` / `getWorklogs` / `getExpectedHoursOverrides`, doubling the query count. `getActiveSession` already avoids this via React `cache()` (`src/repository/clockRepository.ts:11`).

So four independent ~1.4s cold reads that *could* overlap instead sum to ~5.6s, and duplicated reads add more — landing on the cliff.

## Goals / Non-Goals

**Goals:**
- Get the cold initial load reliably under the platform kill line (target ~2s, down from ~8–10s).
- Let independent reads overlap instead of serializing.
- Eliminate duplicate per-request reads.
- Ensure a bad cold wake degrades to slow-but-successful, never a killed 504.
- Keep the change small, low-risk, and cleanly measurable.

**Non-Goals:**
- Swapping the database driver to `@neondatabase/serverless` + `@prisma/adapter-neon`.
- Keep-warm pinging or Neon autosuspend tuning.
- Any change to domain behavior, schema, or the saldo calculation.

## Decisions

### Decision 1: Widen the pg pool (`max: 1` → ~`10`) + add `connectionTimeoutMillis`
The single highest-leverage change. `max: 1` is what defeats the layout's existing `Promise.all` and any page-level parallelism — all reads queue on one connection. Raising `max` lets independent cold reads overlap, plausibly collapsing ~5.6s of serial cold reads toward one ~1.4s round. An explicit `connectionTimeoutMillis` (e.g. 5s) turns a stalled cold connect into a fast, retryable error instead of an unbounded hang that races the function-kill timer.

- **Alternative — Neon serverless driver:** targets the *connection* layer, which the recent trace shows is not the current bottleneck (281ms). It is a larger, higher-blast-radius change (new deps, `ws` polyfill on the Node runtime, must use the WebSocket `Pool` because `clockRepository.ts:45` uses an interactive transaction). It also *replaces* rather than stacks on the pool fix. Deferred to a follow-up, gated on post-change traces showing connect latency dominant again.
- **Alternative — keep-warm:** eliminates the cold start entirely but masks the serialization defect, burns compute budget, and is tier-constrained (Vercel Hobby cron ~1/day; Neon free compute cap). Deferred.

### Decision 2: Wrap `getSettings` / `getWorklogs` / `getExpectedHoursOverrides` in React `cache()`
Completes a pattern already established for `getActiveSession`. `cache()` memoizes per request, so the layout and page share a single read. Free, proven in-repo, removes the duplicate reads visible in both traces (`getWorklogs`/`getSettings`/overrides each appear twice; `getActiveSession` already appears once).

- **Consideration:** `getWorklogs` takes optional `from`/`to` args; `cache()` keys on arguments, so callers passing different ranges correctly get distinct reads. The layout and home page both call the no-arg form, so they dedupe.

### Decision 3: `Promise.all` the home page's independent reads
`page.tsx` currently awaits sequentially. Independent reads (worklogs, settings, overrides, active session) should dispatch together. This only pays off once Decision 1 lifts the pool bottleneck — they ship together.

### Decision 4: Set `maxDuration` on the affected route(s)
A safety net, not a fix: it does not make anything faster, but it ensures a genuinely bad cold wake finishes instead of being killed at the platform default. Set to ~30s.

## Risks / Trade-offs

- **[Widening `max` against a direct (non-pooled) endpoint could exhaust Postgres connections]** → Gating precondition: verify `POSTGRES_PRISMA_URL` is the Neon **pooled** (`-pooler` / `pgbouncer`) endpoint before raising `max`. Repo structure (`POSTGRES_URL_NON_POOLING` as the shadow URL in `prisma.config.mjs`) implies pooled, but the production value lives in Vercel env and must be confirmed. Keep `max` modest (~10) even so.
- **[Neon may serialize cold reads server-side, blunting the concurrency win]** → This is the one assumption we cannot verify statically. Mitigation: the change is a near-one-line pool tweak, trivially reversible, and validated by a forced-cold post-deploy trace. If concurrency does not help, the residual points to keep-warm/driver as the next lever — and we will have measured, not guessed.
- **[`cache()` misapplied to a function with meaningful arguments could over-share]** → Only wrap read functions where per-request sharing is correct; `cache()` keys on args, and the wrapped functions are read-only and user-scoped via `getUserFromSession()`.
- **[Higher `maxDuration` lets a slow request consume more function time/cost]** → Acceptable: it is a ceiling for rare cold starts, not the steady-state path; the other changes keep the common case fast.

## Migration Plan

1. Confirm the pooled-endpoint precondition (Vercel env `POSTGRES_PRISMA_URL`).
2. Apply the four changes; run `npm run test:ci` and `npm run lint`.
3. Deploy. Idle past Neon autosuspend, then load `/` and capture the cold Sentry trace.
4. Confirm cold load drops toward ~2s and no serialization remains. If connect latency dominates again, open a follow-up change for the serverless driver.
- **Rollback:** all changes are config/wrapping-level and independently revertible; reverting the pool `max` alone restores prior behavior.

## Open Questions

- Actual value of `POSTGRES_PRISMA_URL` in Vercel (pooled vs direct) — must be confirmed before merge; gates Decision 1's `max` value.
- Whether Neon serves the first cold reads concurrently — resolved only by the post-deploy forced-cold trace.
