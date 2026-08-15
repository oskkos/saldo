## 1. Survey every environment before changing anything

- [x] 1.1 Run the survey against each environment (production, staging, any other database that receives this migration), recording the result per environment:
      ```sql
      SELECT count(*) FILTER (WHERE "to" <= "from")                  AS non_positive,
             count(*) FILTER (WHERE "to" - "from" > interval '1 day') AS over_long,
             max("to" - "from")                                       AS longest_span
      FROM "Worklog"
      WHERE absence IS NULL;
      ```
      Results, 2026-08-15:

      | environment | work entries | non_positive | over_long | longest span |
      | --- | --- | --- | --- | --- |
      | production (Neon) | 1386 | 1 (`id = 1288`) | 0 | 12:45:00 |
      | local dev (`saldo`) | 7 | 0 | 0 | 09:15:00 |
      | local e2e (`saldo_test`) | 1 | 0 | 0 | 03:00:00 |

      **Not directly surveyed:** the Vercel *Preview* environment. Its database was
      not reachable from here. If previews run against a Neon branch of production
      they inherit production's numbers and the migration handles the one row as it
      does there; if they run against production directly, it is already covered.
      Worth a glance before deploy, though the migration fails safely either way.
- [x] 1.2 If any environment reports `over_long > 0`, stop and bring the rows to the user — the migration is designed to fail on them rather than alter them, and someone must decide what each entry should have been
      — no environment reports one; nothing to escalate.
- [x] 1.3 Record the surveyed numbers in the PR description, so the margin's justification is auditable later rather than resting on a measurement nobody can find

## 2. Constrain the stored span

- [ ] 2.1 Write the migration: delete work entries where `"to" <= "from"`, then `ALTER TABLE "Worklog" ADD CONSTRAINT "Worklog_span_positive_and_bounded" CHECK ("to" > "from" AND "to" - "from" <= interval '1 day')` — in that order, in one migration
- [ ] 2.2 Confirm the delete is scoped so it cannot touch absences or any row with a positive span, and that it reports how many rows it removed
- [ ] 2.3 Add a comment to the `Worklog` model in `prisma/schema.prisma` naming the constraint and the migration that introduces it, since Prisma's schema cannot express a `CHECK` and a future reader has no other signal it exists
- [ ] 2.4 Apply the migration to a fresh database and confirm it succeeds and is correctly ordered (`e2e/global-setup.ts` runs `prisma migrate deploy` from empty)
- [ ] 2.5 Apply it to a database seeded with a violating row and confirm the row is removed and the constraint then applies
- [ ] 2.6 Confirm a database seeded with an over-long row makes the migration fail and roll back, leaving the row untouched — the loud failure is the designed behaviour, so it needs a test rather than a hope

## 3. Bound the overlap read

- [ ] 3.1 Add the lower bound to `overlappingWorkEntries` in `src/repository/worklogRepository.ts`: `from: { gte: subtract(from, 1, 'day'), lt: to }`
- [ ] 3.2 Rewrite the comment above the function to state the proof — a colliding entry ends after `from`, spans at most a day by constraint, therefore begins after `from - 1 day` — and name the constraint the proof depends on
- [ ] 3.3 Update the query-shape assertion in `src/repository/__tests__/worklogRepository.test.ts` to expect the lower bound
- [ ] 3.4 Add a repository test proving the bound cannot hide a conflict: an entry beginning before the bound but reaching into the submitted span is still returned
- [ ] 3.5 Verify the index is actually used with the new bound rather than assumed to be — `EXPLAIN` the query against a database with the index present, and record the plan in the PR

## 4. Verify nothing about overlap behaviour changed

- [ ] 4.1 Run the full unit suite; every existing overlap test must pass untouched, since this change alters cost and storage guarantees, not semantics
- [ ] 4.2 Run the e2e suite, including the overlap-prompt scenarios in `e2e/worklog.spec.ts` and `e2e/time-clock.spec.ts`
- [ ] 4.3 Confirm by hand that an entry overlapping one stored several months earlier is still reported — the case a too-narrow bound would silently break, and the one no existing test covers

## 5. Reconcile the specs and documentation

- [ ] 5.1 Run `/opsx:sync` to apply the deltas to `openspec/specs/`
- [ ] 5.2 Confirm the sync removed the sentence in `data-load-performance` disclaiming the cost guarantee, and restored `Write cost does not grow with history`
- [ ] 5.3 Re-add the exemption for `Write cost does not grow with history` to `scripts/spec-coverage.exemptions.json`, or cover it with the `EXPLAIN` evidence from 3.5 if that turns out to be assertable
- [ ] 5.4 Annotate the new tests with their scenarios and run `npm run spec:coverage`, committing the regenerated `openspec/COVERAGE.md`
- [ ] 5.5 Check `docs/architecture.md` for statements about the overlap read or worklog storage invariants and update them, since the database now enforces something it did not before
- [ ] 5.6 Confirm no user-guide page needs regenerating — no user-visible behaviour changes here — and say so explicitly rather than leaving it unconsidered

## 6. Deploy deliberately

- [ ] 6.1 Note in the PR description that the migration deletes production row `id = 1288` (`user_id = 3265`) and raises that user's saldo by 30 minutes, so the data change is reviewed rather than discovered
- [ ] 6.2 Confirm a rollback plan is written down: dropping the constraint and reverting the query restores prior behaviour, but the deleted row returns only from a backup
