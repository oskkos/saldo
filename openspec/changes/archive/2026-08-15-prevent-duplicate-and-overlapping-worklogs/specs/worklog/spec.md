## ADDED Requirements

### Requirement: Work entries do not silently overlap

The system SHALL detect, before persisting, whether a work entry's time span
overlaps a work entry the current user has already stored, and SHALL NOT persist
it without the user's explicit confirmation. The detection SHALL be performed
against stored records on the server, never against records the client happens to
hold, because the case this rule exists for is a client whose view predates the
conflicting entry.

Two spans overlap when each begins strictly before the other ends. Spans that
merely touch — one beginning at the instant the other ends — SHALL NOT be treated
as overlapping.

**Absences are exempt on both sides.** A stored absence SHALL NOT be reported as
a conflict, and an incoming entry carrying an absence reason SHALL NOT be checked
for overlap. Logging hours on a day that already holds an absence remains
supported and unprompted; absence-against-absence uniqueness is governed
separately and is unaffected.

An edit SHALL exclude the record being edited from its own comparison.

The rule SHALL hold on every path that writes a work entry: creating one,
editing one onto a new span, and finalizing a clock session.

The rule constrains new writes only. Overlapping entries already stored when the
rule takes effect are neither reported nor repaired.

#### Scenario: Identical span is reported as a conflict

- **GIVEN** a stored work entry from 09:00 to 17:00
- **WHEN** the user submits another work entry from 09:00 to 17:00 on the same day
- **THEN** the submission is not persisted
- **AND** a conflict is reported to the user

#### Scenario: Partially overlapping span is reported as a conflict

- **GIVEN** a stored work entry from 09:00 to 17:00
- **WHEN** the user submits a work entry from 16:00 to 18:00 on the same day
- **THEN** the submission is not persisted
- **AND** a conflict is reported to the user

#### Scenario: Touching spans are not a conflict

- **GIVEN** a stored work entry from 08:00 to 12:00
- **WHEN** the user submits a work entry from 12:00 to 16:00 on the same day
- **THEN** no conflict is reported and the entry is persisted

#### Scenario: Non-overlapping spans are not a conflict

- **GIVEN** a stored work entry from 08:00 to 12:00
- **WHEN** the user submits a work entry from 13:00 to 16:00 on the same day
- **THEN** no conflict is reported and the entry is persisted

#### Scenario: The conflict names the entry it collides with

- **WHEN** a work entry is reported as conflicting
- **THEN** the user is shown the span of the stored entry it overlaps, not merely that a conflict exists

#### Scenario: Work on an absence day is not a conflict

- **GIVEN** a day holding an absence
- **WHEN** the user submits a work entry on that day
- **THEN** no conflict is reported and the entry is persisted

#### Scenario: An incoming absence is not overlap-checked

- **GIVEN** a day holding a work entry from 09:00 to 17:00
- **WHEN** an absence is submitted for that day
- **THEN** no overlap conflict is reported

#### Scenario: Editing an entry does not conflict with itself

- **GIVEN** a stored work entry from 09:00 to 17:00
- **WHEN** the user edits that entry to 09:00 to 18:00
- **THEN** no conflict is reported and the edit is persisted

#### Scenario: Editing onto an occupied span is reported as a conflict

- **GIVEN** two stored work entries, 08:00 to 10:00 and 13:00 to 16:00
- **WHEN** the user edits the first to end at 14:00
- **THEN** the edit is not persisted
- **AND** a conflict naming the 13:00 to 16:00 entry is reported

#### Scenario: Confirmed overlap is persisted

- **GIVEN** a work entry reported as conflicting
- **WHEN** the user confirms that it should be saved anyway
- **THEN** the entry is persisted as submitted

#### Scenario: Declined overlap persists nothing

- **GIVEN** a work entry reported as conflicting
- **WHEN** the user declines to save it
- **THEN** nothing is written and the user's input is not discarded

#### Scenario: Detection uses stored state, not the client's view

- **GIVEN** a client whose displayed entries were loaded before a conflicting entry was stored from another session
- **WHEN** the user submits an entry overlapping that unseen stored entry
- **THEN** the conflict is still detected

### Requirement: Worklog create and edit report their outcome as a value

The worklog create, edit and clock-finalize actions SHALL return their outcome to
the caller as a value distinguishing success, a conflict awaiting confirmation,
and a rejection, each carrying the text the user is meant to read. They SHALL NOT
convey a user-facing outcome by throwing, because a production build replaces a
thrown error's message with an opaque identifier and the user would be shown
nothing.

#### Scenario: Success carries the written record

- **WHEN** a worklog is created or edited successfully
- **THEN** the action returns a success outcome carrying the persisted record

#### Scenario: A conflict is returned, not thrown

- **WHEN** a submission overlaps a stored work entry
- **THEN** the action returns a conflict outcome describing the overlapping entry
- **AND** no error is thrown

#### Scenario: A rejection is returned with a readable message

- **WHEN** a submission is rejected
- **THEN** the action returns a rejection outcome whose message is readable by the user in a production build

## MODIFIED Requirements

### Requirement: Worklog mutations are validated server-side

The system SHALL validate worklog create and edit input in the action layer
before delegating to the repository, independently of any client-side checks. A
worklog SHALL fall on a single calendar day with its `to` strictly after its
`from`, an `absence` value that is either absent or one of the recognized
reasons, and a comment no longer than 1000 characters. Invalid input SHALL be
rejected with a human-readable error and SHALL NOT be persisted. The rejection
SHALL be returned to the caller as a value rather than thrown, so the message
survives a production build.

#### Scenario: Non-positive duration rejected

- **WHEN** a worklog is submitted or edited with `to` equal to or before `from`
- **THEN** the action returns a rejection carrying a validation message
- **AND** nothing is written to the database

#### Scenario: Multi-day span rejected

- **WHEN** a worklog is submitted with `from` and `to` on different calendar days
- **THEN** the action returns a rejection carrying a validation message
- **AND** nothing is written to the database

#### Scenario: Unrecognized absence reason rejected

- **WHEN** a worklog is submitted with an `absence` value outside the recognized set
- **THEN** the action returns a rejection carrying a validation message
- **AND** nothing is written to the database

#### Scenario: Valid worklog passes

- **WHEN** a worklog is submitted with `to` after `from`, a recognized or empty absence, and an acceptable comment
- **THEN** validation passes and the worklog is persisted

#### Scenario: Validation is independent of the client

- **WHEN** input reaches the action with invalid values regardless of the calling UI
- **THEN** the same server-side validation applies
