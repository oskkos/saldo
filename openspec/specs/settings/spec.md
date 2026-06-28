# settings Specification

## Purpose

Per-user configuration that parameterizes the [saldo](../saldo/spec.md)
calculation and worklog entry: the balance **begin date**, the **initial
balance** (hours and minutes) carried in at that date, and the **default
from/to times** prefilled when creating a worklog. Each user has exactly one
settings row.

This spec was reverse-engineered from `src/repository/settingsRepository.ts`,
`src/app/settings/settings.tsx`, the `onSettingsUpdate` action, and the Prisma
`Settings` model. It documents current behavior, not a desired future state.

## Requirements

### Requirement: One settings row per user

The system SHALL store exactly one settings row per user, keyed by user id.

#### Scenario: Read own settings

- **GIVEN** an authenticated user with settings
- **WHEN** settings are read
- **THEN** that user's single settings row is returned

#### Scenario: No settings yet

- **GIVEN** an authenticated user without a settings row
- **WHEN** settings are read
- **THEN** null is returned

### Requirement: Default settings on account creation

The system SHALL seed a new user's settings with `beginDate` set to the current
day, a zero initial balance, and the default from/to times, and SHALL not
overwrite settings that already exist.

#### Scenario: Seed on first sign-in

- **GIVEN** a brand-new account
- **WHEN** it is provisioned
- **THEN** settings are created with today's begin date, zero balance, and default times

### Requirement: Update settings

The system SHALL let the authenticated user update their begin date, initial
balance hours and minutes, and default from/to times, creating the row if it
does not yet exist.

#### Scenario: Save settings

- **GIVEN** an authenticated user
- **WHEN** they submit new settings values
- **THEN** their settings row is updated (or created) with those values

### Requirement: Default times must be well-formed and ordered

The system SHALL treat the stored from/to defaults as time-of-day values and
SHALL require the default "from" time to be earlier than the default "to" time
when saving.

#### Scenario: From after to is rejected

- **WHEN** the user saves a default "from" time later than the default "to" time
- **THEN** saving fails with a validation error

#### Scenario: Stored times are validated on read

- **WHEN** settings are read
- **THEN** the stored from/to values are asserted to be valid time-of-day strings

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

## Open Questions

These are behaviors observed in the code that are ambiguous or potentially
defective. They are NOT to be treated as intended requirements until resolved.

- **Seed path bypasses the session gate.** `insertSettings` takes an explicit
  `userId` and is not session-gated, unlike every other repository function.
  This is intentional (it runs during sign-in before a session exists), but it
  is the one exception to the "every repository call resolves the session user"
  rule and should be documented as such.
