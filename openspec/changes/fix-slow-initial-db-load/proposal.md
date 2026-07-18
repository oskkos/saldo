## Why

The initial page load (`GET /`) frequently sits at 8–10s and intermittently times out on Vercel. Two Sentry traces of the home route confirm the cause is **cold-start Postgres work against Neon (scale-to-zero) that is forced to run single-file**:

- **Jun 29 — 9.96s**, dominated by repeated `pg-pool.connect` spans of 1–2s each.
- **Recent (with `cache()` live) — 7.96s**, dominated by first-touch cold `SELECT`s of ~1.4s each on `Worklog`/`Settings`/`User`; connect was only 281ms.

Both traces sit on Vercel's ~10s function-kill line. Actual timeouts exceed 10s and are killed **before** Sentry can flush the transaction, which is why no errored traces exist — the surviving near-misses are the evidence. The common mechanism across both is that independent cold reads that *could* overlap are serialized by three compounding factors: `pg.Pool({ max: 1 })`, sequential `await`s in the home page, and duplicate reads issued by both the root layout and the page.

## What Changes

- **Widen the connection pool.** Raise `pg.Pool` `max` from `1` to ~`10` and add an explicit `connectionTimeoutMillis` in `src/repository/prisma.ts`, so independent queries can run concurrently and a stalled cold connect fails fast instead of hanging until the function is killed. **Gated on a precondition** (see Impact): `POSTGRES_PRISMA_URL` must be the Neon **pooled** endpoint.
- **Deduplicate shared reads per request.** Wrap `getSettings`, `getWorklogs`, and `getExpectedHoursOverrides` in React `cache()` — matching the existing `getActiveSession` pattern (`src/repository/clockRepository.ts:11`) — so data read by both the root layout (Navbar) and the page is fetched once per request instead of twice.
- **Parallelize the home page's own fetches.** Convert the sequential `await`s in `src/app/(calendar)/page.tsx` to a single `Promise.all`.
- **Add a request-duration safety net.** Set `maxDuration` (e.g. 30s) on the affected route(s) so a bad cold wake degrades to a slow-but-successful load instead of a killed 504.

Explicitly **out of scope** (deliberate follow-ups, not part of this change):
- Swapping the driver to `@neondatabase/serverless` + `@prisma/adapter-neon`. The recent trace shows connect is not currently the bottleneck; revisit only if post-change traces show connect latency dominating again.
- Keep-warm / Neon autosuspend tuning. This masks cold starts and consumes compute budget; the changes above should clear the cliff without it.

## Capabilities

### New Capabilities
- `data-load-performance`: Non-functional requirements governing how server-rendered pages load data — request-scoped deduplication of shared reads, concurrent execution of independent reads (including connection-pool sizing that permits it), and a server request-duration guard that prevents premature termination during cold starts.

### Modified Capabilities
<!-- None. This change alters data-access performance characteristics only; no existing spec's user-facing requirements change. -->

## Impact

- **Code:** `src/repository/prisma.ts` (pool config), `src/repository/settingsRepository.ts`, `src/repository/worklogRepository.ts`, `src/repository/expectedHoursOverrideRepository.ts` (wrap reads in `cache()`), `src/app/(calendar)/page.tsx` (parallelize), and route-level `maxDuration` config.
- **Infrastructure precondition (gating):** Raising pool `max` is only safe against the Neon **pooled** (`-pooler` / `pgbouncer`) endpoint. Verify `POSTGRES_PRISMA_URL` in the Vercel project points at the pooled endpoint before increasing `max`; against a direct endpoint a larger pool risks exhausting Postgres `max_connections`. The repo config structure (`POSTGRES_URL_NON_POOLING` used as the shadow URL in `prisma.config.mjs`) strongly implies the pooled endpoint is in use, but the production value lives in Vercel env and must be confirmed.
- **No dependency changes**, no schema changes, no API changes.
- **Validation:** After deploy, capture a forced-cold Sentry trace (idle past Neon autosuspend, then load `/`) and confirm the ~8s serialized cold load drops toward ~2s. If connect latency re-emerges as dominant, escalate to the driver swap as a separate change.
