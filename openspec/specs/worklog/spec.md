# worklog Specification

## Purpose

A **worklog** is a single time entry for a user: a `from`/`to` timestamp pair on a
given day, an optional comment, a lunch-break flag, and an optional absence
reason. Worklogs are the raw records from which the [saldo](../saldo/spec.md)
balance is computed. This capability covers reading, creating, editing, and
deleting worklogs, and the per-user ownership rules that guard them.

This spec was reverse-engineered from `src/repository/worklogRepository.ts`,
`src/actions/index.ts`, and the entry UI under `src/app/worklog-entry/`. It
documents current behavior, not a desired future state. Items that look like
defects or gaps are listed under "Open Questions" rather than written as blessed
requirements.

Worklog storage is the data model that absences also use — an absence is a
worklog with its `absence` field set. The absence *workflow* (multi-day creation,
reason selection) is specified separately under the absence capability; this spec
covers the underlying worklog records.

## Requirements

### Requirement: Worklogs are scoped to the authenticated user

The system SHALL resolve the current user from the session before any worklog
read or write, and SHALL throw if no user is present in the session. All reads
SHALL be filtered to the current user's records.

#### Scenario: No session

- **WHEN** any worklog repository function is called without an authenticated session
- **THEN** the operation throws and no data is read or written

#### Scenario: Listing returns only own worklogs

- **GIVEN** an authenticated user
- **WHEN** worklogs are listed
- **THEN** only worklogs belonging to that user are returned

### Requirement: List worklogs with an optional date range

The system SHALL return the current user's worklogs, optionally bounded by a
`from` lower bound (inclusive, matched against the worklog `from`) and a `to`
upper bound (inclusive, matched against the worklog `to`). When a bound is
omitted, that side is unbounded.

#### Scenario: Range query

- **GIVEN** a `from` and `to` date
- **WHEN** worklogs are listed
- **THEN** only worklogs whose `from` is at or after the lower bound and whose `to` is at or before the upper bound are returned

#### Scenario: Unbounded query

- **WHEN** worklogs are listed with no bounds
- **THEN** all of the user's worklogs are returned

### Requirement: Create a worklog

The system SHALL create a worklog for the current user from a `from` timestamp,
`to` timestamp, comment, `subtractLunchBreak` flag, and optional absence reason,
and SHALL return the created record mapped to the domain type.

#### Scenario: Regular entry

- **GIVEN** an authenticated user and valid worklog form data
- **WHEN** the worklog is created
- **THEN** a new record is persisted for that user and returned

### Requirement: Edit a worklog only if owned

The system SHALL allow editing a worklog's `from`, `to`, comment, and
`subtractLunchBreak` fields only when the worklog belongs to the current user,
and SHALL throw a user-mismatch error otherwise.

#### Scenario: Owner edits

- **GIVEN** a worklog owned by the current user
- **WHEN** it is edited
- **THEN** the listed fields are updated and the record is returned

#### Scenario: Non-owner edit rejected

- **GIVEN** a worklog owned by a different user
- **WHEN** the current user attempts to edit it
- **THEN** the operation throws a user-mismatch error and nothing is changed

### Requirement: Delete a worklog only if owned

The system SHALL delete a worklog only when it belongs to the current user, and
SHALL throw a user-mismatch error otherwise.

#### Scenario: Owner deletes

- **GIVEN** a worklog owned by the current user
- **WHEN** it is deleted
- **THEN** the record is removed

#### Scenario: Non-owner delete rejected

- **GIVEN** a worklog owned by a different user
- **WHEN** the current user attempts to delete it
- **THEN** the operation throws a user-mismatch error and nothing is removed

### Requirement: Map storage rows to the domain type

The system SHALL translate stored worklog rows (snake_case columns) into the
camelCase `Worklog` domain type, mapping `subtract_lunch_break` to
`subtractLunchBreak` and validating the stored `absence` string into an
`AbsenceReason` (or null when empty).

#### Scenario: Unknown absence value

- **GIVEN** a stored worklog whose `absence` value is not a recognized reason
- **WHEN** it is mapped to the domain type
- **THEN** the assertion fails rather than silently producing an invalid value

### Requirement: Worklog mutations are exposed through server actions

The system SHALL expose worklog create, edit, and delete to client components
only through the `'use server'` actions module, which delegates to the repository.

#### Scenario: Client triggers a write

- **WHEN** a client component submits a worklog
- **THEN** the write flows through a server action into the repository, never directly to the database

## Open Questions

These are behaviors observed in the code that are ambiguous, inconsistent, or
potentially defective. They are documented deliberately and are NOT to be treated
as intended requirements until resolved.

- **Edit silently ignores the absence field.** `updateWorklog` updates `from`,
  `to`, comment, and lunch flag, but not `absence`. A worklog created as an
  absence cannot have its reason changed or cleared through editing, and the
  caller gets no error. Intended, or a bug? (See also the saldo spec's
  absence-reason drift question.)
- **No server-side validation of worklog mutations.** Unlike the auth flows
  (signup, password reset), the worklog actions perform no Zod validation. The
  entry UI only asserts that day/time strings are well-*formatted* on the client;
  nothing enforces that `to` is after `from`, that a worklog has non-zero
  duration, or that times are within sane bounds. A malformed or zero/negative
  span would persist and feed straight into the saldo calculation.
- **Existence check precedes ownership check.** Edit and delete first fetch the
  worklog with `findUniqueOrThrow`, then compare ownership. A request for a
  non-existent id throws a "not found" error, while an existing-but-foreign id
  throws "user mismatch" — the differing errors could distinguish which ids
  exist. Low severity, but worth a deliberate decision.
- **Multi-day absence creation is non-transactional.** The absence workflow
  issues one create per day with no surrounding transaction (`absence.tsx` even
  carries a `// TODO: Handle all in one call`). A partial failure leaves some days
  persisted and others not. This belongs to the absence capability but originates
  in repeated worklog creates.
