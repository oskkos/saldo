## MODIFIED Requirements

### Requirement: Update settings

The system SHALL let the authenticated user update their begin date, initial
balance hours and minutes, default from/to times, and default expected minutes
per day, creating the row if it does not yet exist.

#### Scenario: Save settings

- **GIVEN** an authenticated user
- **WHEN** they submit new settings values
- **THEN** their settings row is updated (or created) with those values

### Requirement: Settings updates are validated server-side

The system SHALL validate settings update input in the action layer before
delegating to the repository, independently of any client-side checks. A settings
update SHALL have a present `beginDate`, a default `from` time strictly before the
default `to` time, initial-balance hours and minutes within defined bounds, and a
default expected-minutes-per-day that is a non-negative integer within defined
bounds. Invalid input SHALL be rejected with a human-readable error and SHALL NOT
be persisted.

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

#### Scenario: Out-of-range expected minutes per day rejected

- **WHEN** a settings update has a default expected-minutes-per-day that is negative or outside the allowed bounds
- **THEN** the action throws a validation error
- **AND** the settings row is not changed

#### Scenario: Valid settings pass

- **WHEN** a settings update has a begin date, `from` before `to`, in-range balance values, and an in-range expected-minutes-per-day
- **THEN** validation passes and the settings are persisted
