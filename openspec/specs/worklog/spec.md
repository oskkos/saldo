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

### Requirement: Worklog mutations are validated server-side

The system SHALL validate worklog create and edit input in the action layer
before delegating to the repository, independently of any client-side checks. A
worklog SHALL fall on a single calendar day with its `to` strictly after its
`from`, an `absence` value that is either absent or one of the recognized
reasons, and a comment no longer than 1000 characters. Invalid input SHALL be
rejected with a human-readable error and SHALL NOT be persisted.

#### Scenario: Non-positive duration rejected

- **WHEN** a worklog is submitted or edited with `to` equal to or before `from`
- **THEN** the action throws a validation error
- **AND** nothing is written to the database

#### Scenario: Multi-day span rejected

- **WHEN** a worklog is submitted with `from` and `to` on different calendar days
- **THEN** the action throws a validation error
- **AND** nothing is written to the database

#### Scenario: Unrecognized absence reason rejected

- **WHEN** a worklog is submitted with an `absence` value outside the recognized set
- **THEN** the action throws a validation error
- **AND** nothing is written to the database

#### Scenario: Valid worklog passes

- **WHEN** a worklog is submitted with `to` after `from`, a recognized or empty absence, and an acceptable comment
- **THEN** validation passes and the worklog is persisted

#### Scenario: Validation is independent of the client

- **WHEN** input reaches the action with invalid values regardless of the calling UI
- **THEN** the same server-side validation applies

### Requirement: Worklog entry supports a duration mode

The worklog entry form SHALL offer two mutually exclusive input modes — **Times**
(a `from`/`to` pair) and **Duration** (hours + minutes) — toggled by the user.
Regardless of mode, a worklog is stored as a `from`/`to` pair; Duration mode is an
input affordance only and introduces no new stored field.

In Duration mode:

- The duration entered SHALL be interpreted as the **net worked minutes** — the
  value that contributes to saldo (`worklogMinutes`) — not the raw `to − from`
  span. The "subtract lunch break" control SHALL be hidden, and the saved
  worklog's `subtractLunchBreak` flag SHALL be `false`.
- Hours SHALL be a non-negative integer and minutes an integer in the range
  0–59; the total duration SHALL be strictly greater than zero.
- On save the system SHALL synthesize `from` and `to` from an **anchor** start
  time: `from` = anchor, `to` = anchor + duration. The anchor SHALL be the
  worklog's existing `from` when editing an entry that already has one, and the
  user's configured default start time (`fromDefault`) otherwise.
- If `anchor + duration` does not fall on the same calendar day as the anchor,
  the entry SHALL be rejected with a duration-specific error and SHALL NOT be
  persisted.

The edit form SHALL open in Times mode for an existing worklog so that editing
unrelated fields does not rewrite the stored times. When the user switches an
existing worklog into Duration mode, the hours/minutes SHALL be prefilled from
the worklog's current net worked minutes.

#### Scenario: New entry from duration uses the default start

- **GIVEN** a user whose default start time is 08:00
- **WHEN** they create a worklog in Duration mode of 7h 30min
- **THEN** the worklog is persisted with `from` 08:00, `to` 15:30, and `subtractLunchBreak` false

#### Scenario: Editing an existing entry in duration mode keeps its start

- **GIVEN** an existing worklog from 09:15 to 16:45
- **WHEN** the user switches to Duration mode and saves 8h 0min
- **THEN** the worklog is persisted with `from` 09:15 and `to` 17:15

#### Scenario: Duration is net worked time, not span

- **GIVEN** an existing worklog from 08:00 to 16:00 with the lunch break subtracted (net 7h 30min)
- **WHEN** the user switches to Duration mode
- **THEN** the hours/minutes are prefilled to 7h 30min
- **AND** saving unchanged persists `from` 08:00, `to` 15:30, `subtractLunchBreak` false, leaving the saldo contribution unchanged at 7h 30min

#### Scenario: Duration crossing midnight is rejected

- **WHEN** a worklog is saved in Duration mode where the anchor start plus the duration falls on a later calendar day
- **THEN** the entry is rejected with a duration-specific error
- **AND** nothing is written to the database

#### Scenario: Non-positive duration is rejected

- **WHEN** a worklog is saved in Duration mode with a total duration of zero
- **THEN** the entry is rejected
- **AND** nothing is written to the database

#### Scenario: Edit opens in times mode

- **WHEN** the edit form is opened for an existing worklog
- **THEN** it starts in Times mode showing the stored `from`/`to`
- **AND** the stored times are not modified unless the user changes them

## Open Questions

These are behaviors observed in the code that are ambiguous, inconsistent, or
potentially defective. They are documented deliberately and are NOT to be treated
as intended requirements until resolved.

- **Edit silently ignores the absence field.** `updateWorklog` updates `from`,
  `to`, comment, and lunch flag, but not `absence`. A worklog created as an
  absence cannot have its reason changed or cleared through editing, and the
  caller gets no error. Intended, or a bug? (See also the saldo spec's
  absence-reason drift question.)
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
