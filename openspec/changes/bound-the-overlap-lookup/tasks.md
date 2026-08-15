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

- [x] 2.1 Write the migration: delete work entries where `"to" <= "from"`, then `ALTER TABLE "Worklog" ADD CONSTRAINT "Worklog_span_positive_and_bounded" CHECK ("to" > "from" AND "to" - "from" <= interval '1 day')` — in that order, in one migration — `20260815130500_constrain_worklog_span`, wrapped in an explicit BEGIN/COMMIT (see 2.6)
- [x] 2.2 Confirm the delete is scoped so it cannot touch absences or any row with a positive span, and that it reports how many rows it removed — scoped to `absence IS NULL` and `"to" <= "from"`; the constraint is scoped identically so the two cannot disagree. Verified an inverted *absence* row survives while a zero-length work entry is deleted
- [x] 2.3 Add a comment to the `Worklog` model in `prisma/schema.prisma` naming the constraint and the migration that introduces it, since Prisma's schema cannot express a `CHECK` and a future reader has no other signal it exists
- [x] 2.4 Apply the migration to a fresh database and confirm it succeeds and is correctly ordered (`e2e/global-setup.ts` runs `prisma migrate deploy` from empty) — verified: fresh database, `prisma migrate deploy` from empty, constraint present afterwards
- [x] 2.5 Apply it to a database seeded with a violating row and confirm the row is removed and the constraint then applies — verified: zero-length work entry deleted, valid entry and inverted absence untouched, constraint then applied
- [x] 2.6 Confirm a database seeded with an over-long row makes the migration fail and roll back, leaving the row untouched — the loud failure is the designed behaviour, so it needs a test rather than a hope — verified, and it caught a defect: Prisma does NOT wrap a migration in a transaction, so the DELETE committed while ADD CONSTRAINT failed. Fixed with explicit BEGIN/COMMIT; re-tested, both rows now survive and the constraint is absent

## 3. Bound the overlap read

- [x] 3.1 Add the lower bound to `overlappingWorkEntries` in `src/repository/worklogRepository.ts`: `from: { gte: subtract(from, 1, 'day'), lt: to }`
- [x] 3.2 Rewrite the comment above the function to state the proof — a colliding entry ends after `from`, spans at most a day by constraint, therefore begins after `from - 1 day` — and name the constraint the proof depends on — the comment now states the proof and names `Worklog_work_entry_span_positive_and_bounded` as what it rests on
- [x] 3.3 Update the query-shape assertion in `src/repository/__tests__/worklogRepository.test.ts` to expect the lower bound
- [x] 3.4 Add a repository test proving the bound cannot hide a conflict: an entry beginning before the bound but reaching into the submitted span is still returned — pins the relationship between bound and constraint: the longest permitted entry that still reaches the submitted span must fall inside the queried range
- [x] 3.5 Verify the index is actually used with the new bound rather than assumed to be — `EXPLAIN` the query against a database with the index present, and record the plan in the PR — verified against a 3135-row history with the index present. The result is
      stronger than expected: **the old query did not use the index at all.**

      | | plan | buffers | rows discarded |
      | --- | --- | --- | --- |
      | before (`from < to` only) | Seq Scan | 33 | 3134 |
      | after (`gte` added) | Index Scan using `Worklog_user_id_from_idx` | 3 | — |

      An unbounded range covered nearly the whole table, so the planner declined the
      index. This means the *previous* change's "Overlap detection on write" scenario
      was not actually satisfied either — the index existed but went unused on this
      query shape.

## 4. Verify nothing about overlap behaviour changed

- [x] 4.1 Run the full unit suite; every existing overlap test must pass untouched, since this change alters cost and storage guarantees, not semantics — 676 passing, every existing overlap test untouched
- [ ] 4.2 Run the e2e suite, including the overlap-prompt scenarios in `e2e/worklog.spec.ts` and `e2e/time-clock.spec.ts`
- [x] 4.3 Confirm by hand that an entry overlapping one stored several months earlier is still reported — the case a too-narrow bound would silently break, and the one no existing test covers — covered by a test rather than by hand, which is stronger: `anchors the range
      to the submitted span, not to today` pins that a backfilled entry is checked
      against its own date. The failure mode worth guarding is re-anchoring the bound
      to `now()`, which no hand-check would reliably catch.

## 5. Reconcile the specs and documentation

- [x] 5.1 Run `/opsx:sync` to apply the deltas to `openspec/specs/`
- [x] 5.2 Confirm the sync removed the sentence in `data-load-performance` disclaiming the cost guarantee, and restored `Write cost does not grow with history` — confirmed: the disclaiming paragraph is gone and both scenarios are present in `openspec/specs/data-load-performance/spec.md`
- [x] 5.3 Re-add the exemption for `Write cost does not grow with history` to `scripts/spec-coverage.exemptions.json`, or cover it with the `EXPLAIN` evidence from 3.5 if that turns out to be assertable — exempted rather than covered. The EXPLAIN evidence from 3.5 is a manual
      measurement, not something either layer can assert: the unit layer mocks Prisma and
      the e2e database is reset per test, so it never holds a long history. The exemption
      records the measured numbers. Two migration scenarios are exempted for the same
      class of reason — the suite runs after migrations, so it can never observe them.
- [x] 5.4 Annotate the new tests with their scenarios and run `npm run spec:coverage`, committing the regenerated `openspec/COVERAGE.md` — added `e2e/worklog-span.spec.ts` covering the 5 constraint-behaviour scenarios against a real database, annotated the new repository test, regenerated `COVERAGE.md`: 260 scenarios, 233 covered, 27 exempt, **0 uncovered**
- [x] 5.5 Check `docs/architecture.md` for statements about the overlap read or worklog storage invariants and update them, since the database now enforces something it did not before — updated both places: the repository-invariants section now states the bound depends on the constraint, and the `Worklog` model entry names the constraint and its migration
- [x] 5.6 Confirm no user-guide page needs regenerating — no user-visible behaviour changes here — and say so explicitly rather than leaving it unconsidered — confirmed, no page needs regenerating. Triaging the guide's `uncovered` list
      per the skill's rule: the one new entry is `worklog :: A stored work entry spans a
      positive, bounded length of time`, which is plumbing — a storage constraint with no
      user-visible surface, since form validation already prevents a user from submitting
      such a span. Nothing a reader could act on.

## 6. Deploy deliberately

- [ ] 6.1 Note in the PR description that the migration deletes production row `id = 1288` (`user_id = 3265`) and raises that user's saldo by 30 minutes, so the data change is reviewed rather than discovered
- [ ] 6.2 Confirm a rollback plan is written down: dropping the constraint and reverting the query restores prior behaviour, but the deleted row returns only from a backup
