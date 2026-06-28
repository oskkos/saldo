## ADDED Requirements

### Requirement: Settings updates are validated server-side

The system SHALL validate settings update input in the action layer before
delegating to the repository, independently of any client-side checks. A settings
update SHALL have a present `beginDate`, a default `from` time strictly before the
default `to` time, and initial-balance hours and minutes within defined bounds.
Invalid input SHALL be rejected with a human-readable error and SHALL NOT be
persisted.

#### Scenario: Inverted default times rejected

- **WHEN** a settings update has its default `from` time at or after its default `to` time
- **THEN** the action throws a validation error
- **AND** the settings row is not changed

#### Scenario: Missing begin date rejected

- **WHEN** a settings update has no `beginDate`
- **THEN** the action throws a validation error
- **AND** the settings row is not changed

#### Scenario: Out-of-range initial balance rejected

- **WHEN** a settings update has initial-balance hours or minutes outside the allowed bounds
- **THEN** the action throws a validation error
- **AND** the settings row is not changed

#### Scenario: Valid settings pass

- **WHEN** a settings update has a begin date, `from` before `to`, and in-range balance values
- **THEN** validation passes and the settings are persisted
