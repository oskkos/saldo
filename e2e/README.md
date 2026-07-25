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
- **`time-clock.spec.ts`** — the scenarios below. Time is controlled with
  Playwright's `page.clock` so clock-in/out instants are deterministic.

## Scenario → test traceability (openspec/specs/time-clock/spec.md)

| Requirement                                                     | Scenario                                              | Test                                                                |
| --------------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------- |
| Clock state is visible across the app                           | Idle home screen                                      | `idle home screen shows a clock-in action`                          |
| Clock in starts a single open session                           | Clock in when idle                                    | `clock in when idle shows the clocked-in state`                     |
| Clock state is visible across the app                           | Running state is globally visible                     | `running state is visible across the app (badge + clock-out)`       |
| Forgotten sessions are handled on return                        | Returning with an open session                        | `returning with an open session shows the running state, unchanged` |
| Clock out finalizes the session / timestamps reflect wall-clock | Save creates a worklog / Logged times match the clock | `save creates a worklog spanning the session and clears it`         |
| Clock out finalizes the session                                 | Cancel keeps the session open                         | `cancel keeps the session open and logs nothing`                    |
| Discard a session without logging                               | Discard                                               | `discard clears the session without logging`                        |
| Sessions may not span more than one day                         | Overnight session must be corrected or discarded      | `overnight session must be corrected or discarded before saving`    |

The remaining time-clock scenarios (already-clocked-in idempotency, clock-out
transaction atomicity, the no-user session gate) are covered at the data layer in
`src/repository/__tests__/clockRepository.test.ts`, since they are not observable
through the UI.
