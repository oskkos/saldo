## 1. Warm-up helper

- [x] 1.1 Add a `server-only` `warmUpDb()` helper in `src/repository/` that runs `prisma.$queryRaw` `SELECT 1`, wrapped in a `Sentry.startSpan` (op `db.sql.prisma`, name `warmUpDb`) so the compute wake is visible in traces. No session/ownership check needed — it reads no user data.

## 2. Wire into the root layout

- [ ] 2.1 In `src/app/layout.tsx`, `await warmUpDb()` before the existing session-gated `Promise.all([...])`, gated on the same session condition so it runs only when the request will perform DB reads. Preserve current behavior for the unauthenticated branch (no warm-up).

## 3. Verify

- [ ] 3.1 Run `npm run test:ci`, `npm run lint`, and `tsc --noEmit`; fix any regressions.

## 4. Post-deploy validation

- [ ] 4.1 Idle past Neon autosuspend, load `/`, and capture a cold Sentry trace. Confirm ~8.6s → ~1.5s: a single ~1s `warmUpDb` span, followed by the page reads overlapping (not serialized at ~1s each). If the reads still each pay a ~1s cold connect after the warm-up, the warm-up hypothesis is wrong — reassess toward a paid Neon plan (extend autosuspend) rather than the driver swap.
