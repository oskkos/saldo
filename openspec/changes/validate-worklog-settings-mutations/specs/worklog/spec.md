## ADDED Requirements

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
