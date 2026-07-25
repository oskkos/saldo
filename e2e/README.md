# End-to-end tests (Playwright)

Browser tests that drive the real app against a dedicated Postgres database. This
is the pilot suite; it covers the **time-clock** capability end-to-end. New
capabilities follow the same shape.

## Running locally

```bash
docker compose up -d db                                   # Postgres on localhost:3006
docker compose exec -T db psql -U postgres \
  -c "CREATE DATABASE saldo_test"                         # once; ignore "already exists"
cp .env.e2e.example .env.e2e                              # once
npm run test:e2e                                          # runs migrations + seed + tests
# npm run test:e2e:ui                                     # watch/debug in the Playwright UI
```

`playwright.config.ts` loads `.env.e2e`, applies migrations and seeds the test
user in `global-setup`, then boots the app on **port 3100** (so it never collides
with a dev server on 3000). The app server runs in a non-UTC timezone on purpose,
to prove the clock scenarios are timezone-independent.

## How it works

- **`db.ts`** — a standalone Prisma client against `saldo_test` (not the app's
  server-only singleton). Seeds the test user + default settings and resets clock
  state between tests.
- **`global-setup.ts`** — `prisma migrate deploy` + seed, once per run.
- **`auth.setup.ts`** — signs in once via the Credentials form and saves the
  session (`e2e/.auth/user.json`); every test reuses it.
- **`time-clock.spec.ts`** — the time-clock scenarios. Time is controlled with
  Playwright's `page.clock` so clock-in/out instants are deterministic.

## Scenario → test traceability

Which spec scenarios these tests cover is recorded in the generated coverage map
at [`openspec/COVERAGE.md`](../openspec/COVERAGE.md), not here — a hand-written
table drifts silently, and two records of the same thing eventually disagree.

Each test declares what it covers with an annotation directly above it:

```ts
// @scenario time-clock/Clock in when idle
test('clock in when idle shows the clocked-in state', async ({ page }) => {
```

Regenerate the map with `npm run spec:coverage` after changing annotations; CI
runs `npm run spec:coverage:ci`, which fails on an uncovered scenario, a stale
map, or an annotation naming a scenario that no longer exists. A test may claim
a scenario only if it asserts that scenario's THEN outcome.
