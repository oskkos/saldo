## Why

Every worklog write performs an overlap read whose index range is open at its lower
end. `overlappingWorkEntries` filters `from < to` with no lower bound, so the
`(user_id, from)` index range covers every entry the user has ever logged before the
submitted span; only the non-indexable `to > from` filter trims it. The cost of
creating, editing or clock-finalizing a worklog therefore grows with the size of the
user's history rather than staying near the submitted span. The
`prevent-duplicate-and-overlapping-worklogs` change added the index but not the
bound, and its "Write cost does not grow with history" scenario was withdrawn
because the code did not satisfy it.

A lower bound is only correct if a stored entry cannot begin arbitrarily far before
it ends. That invariant is currently asserted by a Zod schema alone, and production
data shows the schema has not always held: one row has `to == from`, written in
September 2025 and never edited. It is not merely inert — `subtract_lunch_break` is
set on it, so `worklogMinutes` returns −30 and that user's saldo has been half an
hour low ever since.

## What Changes

- Bound the overlap read below, so its index range covers days near the submitted
  span instead of the user's full history.
- Enforce the span invariant the bound relies on with a database `CHECK`
  constraint, rather than trusting application-level validation that has already
  been bypassed once.
- Repair rows that violate the invariant, as a prerequisite of the constraint:
  `ADD CONSTRAINT ... CHECK` validates existing rows, so the migration fails on any
  database holding one. Cleanup and constraint must land in the same migration, in
  that order.
- Restore the "Write cost does not grow with history" scenario withdrawn from the
  `data-load-performance` spec, and drop the sentence disclaiming it.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `data-load-performance`: the index requirement regains the claim that the overlap
  read's cost is bounded by entries near the submitted span rather than by history
  size.
- `worklog`: the stored-span invariant becomes a guarantee about stored records
  enforced by the database, not only a validation rule applied on the way in.

## Impact

- `src/repository/worklogRepository.ts` — `overlappingWorkEntries` gains a lower
  bound on `from`.
- `prisma/schema.prisma` and a new migration — the `CHECK` constraint plus the
  cleanup that must precede it. Prisma has no schema-level syntax for a table
  `CHECK`, so the constraint is hand-written SQL in the migration and the model
  carries a comment pointing at it.
- **Production data**: one row is deleted or normalized (`id = 1288`,
  `user_id = 3265`). That user's saldo moves up by 30 minutes — a correction, but a
  visible change to a real balance.
- Other environments are unmeasured. Only production was surveyed; the migration
  must repair whatever it finds rather than assume a single known row.
- No API or user-visible behavior changes. The overlap prompt, its wording and every
  outcome the user sees are unaffected.
