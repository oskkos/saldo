## Why

The saldo service tests reference absence reasons `vacation` and `unpaid_leave`,
which are not part of the canonical reason set defined by the `AbsenceReason`
type and the Prisma `Absence` enum (`holiday`, `flex_hours`, `sick_leave`,
`other`). The tests only pass because they cast fixtures through `as unknown`,
bypassing the type system, and never touch the database. This drift was flagged
as an open question in the `absence` and `saldo` baseline specs. We are resolving
it by declaring `holiday` canonical — in European usage "holiday" means
annual/vacation leave — and correcting the tests to match.

## What Changes

- Decide and document that `holiday` is the canonical absence reason for
  annual/vacation leave; the canonical set stays `holiday`, `flex_hours`,
  `sick_leave`, `other`.
- Update `src/services/__tests__/index.test.tsx` to use canonical reasons:
  replace `vacation` fixtures with `holiday`, and replace the
  `absenceReasonToString` input list (`vacation`, `unpaid_leave`) with the real
  reason set.
- Close the absence-reason-drift open questions in the `absence` and `saldo`
  specs.
- No production code, enum, type, UI, or database changes. `vacation` and
  `unpaid_leave` appear nowhere outside these tests.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `absence`: Clarify the "Fixed set of absence reasons" requirement to state that
  `holiday` denotes annual/vacation leave, and remove the now-resolved
  reason-drift open question.

## Impact

- **Tests**: `src/services/__tests__/index.test.tsx` (fixtures + the
  `absenceReasonToString` assertion). No other test files reference the stale
  names.
- **Specs**: `absence` (delta, this change). The `saldo` spec carries the same
  drift note as a non-normative open question; it will be reconciled to point at
  the resolved `absence` decision during spec sync.
- **No runtime impact**: no changes to `src/types`, `prisma/schema.prisma`,
  migrations, or any component. `npm run test:ci` is the verification.
