## Context

`overlappingWorkEntries` reads the candidate entries a submitted span could collide
with:

```ts
where: {
  user_id: userId,
  absence: null,
  from: { lt: to },
  to: { gt: from },
}
```

`from < to` is index-backed on `(user_id, from)`, but it is an upper bound only. The
index range therefore starts at the user's earliest entry and runs forward to the
submitted span; `to > from` is not part of the index and only discards rows after
they have been read. Every create, edit and clock-finalize pays that cost, and it
grows with the user's history.

Adding a lower bound is straightforward. Establishing that it is *correct* is the
substance of this change: a lower bound of `from - M` can only be safe if no stored
entry spans more than `M`. Today nothing in the database enforces any span at all.
`WorklogSchema` requires a worklog to start and end on the same UTC day, but that is
application-level validation applied on the way in, and production evidence shows it
has been bypassed: `id = 1288` has `to == from`, created 2025-09-11 and never edited.

Production, measured 2026-08-15: 1386 work entries, longest span 12:45:00, none
crossing midnight, none longer than a day, one with a non-positive span. Other
environments have not been surveyed.

## Goals / Non-Goals

**Goals:**

- Make the overlap read's cost a function of the submitted span's neighbourhood
  rather than of the user's history size.
- Ground the bound in an invariant the database enforces, so its safety does not
  depend on validation that has already failed once.
- Leave the database with no rows that violate that invariant.
- Restore the `data-load-performance` scenario withdrawn when the bound was set
  aside.

**Non-Goals:**

- Changing overlap semantics. Which entries count as conflicting, the prompt, its
  wording and every user-visible outcome are unchanged.
- Repairing historical overlaps. The existing rule constrains new writes only and
  that is unaffected.
- Enforcing the *same-day* rule in the database. The constraint bounds span length,
  which is what the query depends on; same-day remains `WorklogSchema`'s to make.
- Auditing saldo balances generally. One row is corrected because the constraint
  requires it, not as part of a data-quality sweep.

## Decisions

### Bound the span in the database, not just the day

The constraint is `CHECK ("to" > "from" AND "to" - "from" <= interval '1 day')`.

The tempting constraint is `"to" > "from"` alone, since that is what the bad row
violates. It is not enough: it rejects non-positive spans but permits a five-day
entry, so it would not make any lower bound safe. The query's correctness depends on
a bound on *span length*, so that is what the constraint states.

Both columns are `TIMESTAMP(3)` without time zone, so `"to" - "from"` is an
immutable interval expression and legal in a `CHECK`.

Considered and rejected: `CHECK ("from"::date = "to"::date)`, mirroring
`WorklogSchema` exactly. It is a stronger claim than the query needs, it would
reject a legitimate 23:00→01:00 session if that rule is ever relaxed, and it couples
a storage invariant to a policy that belongs in the schema layer.

### Margin of one day, applied to the raw instant

The lower bound becomes `from: { gte: subtract(from, 1, 'day'), lt: to }`.

With the constraint in place the proof is direct: a colliding entry `E` satisfies
`E.to > from`, and `E.to - E.from <= 1 day`, therefore `E.from > from - 1 day`. The
bound cannot exclude a real conflict. It is stated against the submitted instant
rather than `startOfDay(from)` because the constraint bounds span, not calendar day
— tying it to midnight would add a dependency on the same-day rule that the
constraint deliberately does not make.

Measured against production this leaves ample headroom: the longest stored span is
12:45.

### Cleanup deletes only what provably carries no information

The migration deletes work entries with `to <= from`. A work entry that ends no
later than it starts records no work; deleting it is the only repair that does not
invent data. The one production row also has `subtract_lunch_break` set, so removing
it corrects that user's saldo by +30 minutes.

Rows with a span longer than a day are *not* touched. They represent real logged
time and clamping or deleting them would destroy it. None exist in production; if
one exists elsewhere, `ADD CONSTRAINT` fails and the migration rolls back, which is
the correct outcome — a human decides what that entry should have been. This is a
deliberate choice to let the migration fail loudly rather than silently mangle data.

Considered and rejected: normalizing `id = 1288` by hand in the production console
and shipping only the constraint. That leaves every other environment unrepaired,
and the survey covered production alone.

### Cleanup and constraint are one migration, in that order

`ALTER TABLE ... ADD CONSTRAINT ... CHECK` validates existing rows, so the constraint
cannot be added to a database still holding a violating row. Splitting them across
two migrations would leave a window in which deploy order determines success.

`NOT VALID` would let the constraint through without validating, and was rejected:
it would leave the bad row in place, still costing a real user 30 minutes, while
presenting the invariant as enforced.

### The constraint lives in the migration, with a marker in the schema

Prisma's schema language cannot express a table `CHECK`, so the constraint is
hand-written SQL in the migration. `prisma/schema.prisma` carries a comment on the
`Worklog` model recording that the constraint exists and where, so a future reader
editing the model knows it is there.

## Risks / Trade-offs

- **An unsurveyed environment holds a span longer than a day** → the migration fails
  on `ADD CONSTRAINT` and rolls back atomically. Nothing is half-applied. The fix is
  to inspect the row and decide deliberately; the survey query is in the tasks.
- **Prisma does not model `CHECK` constraints, so it cannot detect their absence** →
  a future `migrate dev` against a drifted database could regenerate a schema without
  it. Mitigated by the schema comment and by a test asserting the constraint rejects
  a non-positive span, which fails if the constraint is ever lost.
- **The bound's safety depends on the constraint being present** → the two ship in
  the same change and the same migration. The proof in the code comment names the
  constraint explicitly, so the coupling is discoverable from the query.
- **A real user's balance changes** → user 3265 gains 30 minutes. The correction is
  in their favour and restores the balance they should always have had, but it is a
  visible change to production data and should be noted in the PR rather than
  slipped in.
- **`interval '1 day'` is wider than the same-day rule allows** → deliberate. The
  constraint is a storage-level backstop, not a restatement of the input policy; a
  tighter bound would couple the two.

## Migration Plan

1. Survey every environment for rows the constraint would reject, using the query in
   the tasks. Production is known: one row with `to == from`.
2. Deploy the migration. It deletes non-positive-span work entries, then adds the
   constraint, inside an explicit `BEGIN`/`COMMIT`.

   The explicit transaction is required, not decorative. **Prisma does not wrap a
   migration file in a transaction** — verified by seeding a database with both a
   zero-length row and an over-long one and running `prisma migrate deploy`: the
   `DELETE` committed and stayed committed after `ADD CONSTRAINT` failed, leaving
   the database half-migrated on precisely the environment that needs a human to
   look at it. With `BEGIN`/`COMMIT` the same test leaves both rows intact and the
   constraint absent.
3. Deploy the query change. It is safe in either order: the bound is correct as soon
   as the constraint holds, and the constraint is independent of the query.

**Rollback:** drop the constraint and revert the query change. The deleted row is not
restored by a rollback; it is recoverable only from a backup, which is why the survey
precedes the deploy.

## Open Questions

- Should `worklogMinutes` clamp at zero as defence in depth? The constraint makes a
  negative duration unreachable through storage, so this is belt-and-braces rather
  than a fix, and it would mask rather than surface any future violation. Left out
  deliberately; raised here because the bad row's effect ran through that function.
