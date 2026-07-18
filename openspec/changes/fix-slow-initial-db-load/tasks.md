## 1. Precondition: confirm pooled endpoint

- [x] 1.1 Verify `POSTGRES_PRISMA_URL` in the Vercel project points at the Neon **pooled** endpoint (host contains `-pooler`, typically `pgbouncer=true`). Record the finding. If it is the **direct** endpoint, stop and reassess before widening the pool. — **Confirmed: `-pooler` endpoint in use; safe to widen the pool.**

## 2. Widen the connection pool

- [x] 2.1 In `src/repository/prisma.ts`, raise `pg.Pool` `max` from `1` to `10` and add `connectionTimeoutMillis` (e.g. `5000`).
- [x] 2.2 Confirm the `globalForPrisma` singleton pattern still holds (pool + client cached on `globalThis`) so the wider pool is reused across invocations within a warm instance.

## 3. Deduplicate shared reads per request

- [x] 3.1 Wrap `getSettings` in `src/repository/settingsRepository.ts` with React `cache()`, matching the `getActiveSession` pattern in `src/repository/clockRepository.ts:11`.
- [x] 3.2 Wrap `getWorklogs` in `src/repository/worklogRepository.ts` with `cache()`; confirm the optional `from`/`to` args are preserved so distinct ranges are not incorrectly shared.
- [x] 3.3 Wrap `getExpectedHoursOverrides` in `src/repository/expectedHoursOverrideRepository.ts` with `cache()`.

## 4. Parallelize the home page reads

- [ ] 4.1 In `src/app/(calendar)/page.tsx`, convert the sequential `await`s (worklogs, settings, overrides, active session) into a single `Promise.all`, preserving the existing `assertExists(settings)` and `searchParams` handling.

## 5. Request-duration safety net

- [ ] 5.1 Add `export const maxDuration = 30` to the affected route(s) (home page; extend to other DB-backed pages if trivially applicable), so a cold wake degrades to slow-but-successful rather than a killed 504.

## 6. Verify

- [ ] 6.1 Run `npm run test:ci` and `npm run lint`; fix any regressions (type/lint/tests).
- [ ] 6.2 Post-deploy validation: idle past Neon autosuspend, load `/`, capture a cold Sentry trace, and confirm the ~8s serialized cold load drops toward ~2s with reads overlapping and no duplicate `getSettings`/`getWorklogs`/`getExpectedHoursOverrides` spans. If connect latency re-emerges as dominant, open a follow-up change for the `@neondatabase/serverless` driver swap.
