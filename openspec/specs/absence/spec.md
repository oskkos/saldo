# absence Specification

## Purpose

An **absence** records a day a user did not work normally — a holiday, a flex
day, sick leave, or other. Absences are how non-worked days enter the
[saldo](../saldo/spec.md) calculation and the statistics. This capability covers
the set of absence reasons, how absences are entered across a date range, and how
they are presented.

Storage-wise an absence is not a separate model: it is a [worklog](../worklog/spec.md)
with its `absence` field set. This spec covers the absence-specific behavior; the
underlying record lifecycle (create/edit/delete, ownership) lives in the worklog
spec.

This spec was reverse-engineered from `src/app/absence/absence.tsx`,
`src/services/index.tsx` (`absenceReasonToString`), `src/components/worklogItem/absenceIcon.tsx`,
the `AbsenceReason` type, and the Prisma `Absence` enum. It documents current
behavior, not a desired future state.

## Requirements

### Requirement: Fixed set of absence reasons

The system SHALL support exactly these absence reasons: `holiday`, `flex_hours`,
`sick_leave`, and `other`. These values SHALL be the only ones offered in the
entry UI and the only ones the database accepts.

#### Scenario: Reason selection

- **WHEN** a user enters an absence
- **THEN** they choose from holiday, flex hours, sick leave, or other

### Requirement: Multi-day absence over a date range

The system SHALL let a user create an absence spanning an inclusive date range by
choosing a from-date, a to-date, a reason, and a comment, producing one absence
record per day in the range. Each record SHALL use the configured default times
and mark the lunch break as subtracted.

#### Scenario: Three-day absence

- **GIVEN** a from-date and a to-date three days apart
- **WHEN** the absence is submitted
- **THEN** three absence records are created, one per day, all with the chosen reason and comment

#### Scenario: Range normalization

- **WHEN** the chosen from-date is after the to-date
- **THEN** the UI keeps the range coherent so the from-date is not after the to-date

### Requirement: Human-readable reason labels

The system SHALL render reason codes as human-friendly labels by capitalizing the
first letter and replacing underscores with spaces (e.g. `sick_leave` →
"Sick leave").

#### Scenario: Label formatting

- **WHEN** a reason is displayed
- **THEN** `flex_hours` is shown as "Flex hours" and `sick_leave` as "Sick leave"

### Requirement: Reason iconography

The system SHALL display a distinct icon per absence reason in worklog listings.

#### Scenario: Icon per reason

- **WHEN** an absence appears in a worklog list
- **THEN** an icon corresponding to its reason is shown

## Open Questions

These are behaviors observed in the code that are ambiguous, inconsistent, or
potentially defective. They are NOT to be treated as intended requirements until
resolved.

- **Reason drift between code and tests.** The canonical reasons are
  `holiday`, `flex_hours`, `sick_leave`, `other` — enforced by both the
  `AbsenceReason` type and the Prisma `Absence` enum. The saldo service tests
  instead use `vacation` and `unpaid_leave` (cast through `as unknown` so they
  never hit the type system or the database). The tests are stale relative to the
  real reason set; align them, or change the reason set if `vacation`/`unpaid_leave`
  are actually wanted. (Cross-referenced from the saldo spec.)
- **Multi-day creation is non-transactional.** Each day is a separate create
  with no surrounding transaction (the code carries a `// TODO: Handle all in one
  call`). A failure partway leaves some days persisted and others not.
- **Absence reason cannot be edited.** Editing a worklog does not touch its
  `absence` field, so an absence's reason cannot be changed or cleared after
  creation. (Cross-referenced from the worklog spec.)
- **Always full-day, fixed times.** Absences are written with the default times
  and always count as a full expected day in the saldo. Partial-day absences are
  not supported through the UI, and the saldo would ignore custom times even if
  one were created.
- **No overlap detection.** Nothing prevents creating an absence on a day that
  already has a worklog (or another absence). Both records would then be counted
  in the saldo and statistics. Decide whether overlaps should be prevented or
  merged.
