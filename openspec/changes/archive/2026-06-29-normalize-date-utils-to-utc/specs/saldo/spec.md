## ADDED Requirements

### Requirement: Saldo calculation is timezone-independent

The system SHALL compute the saldo using UTC date math, so the result depends only
on the stored worklog instants and settings, not on the runtime timezone. Day
boundaries, working-day determination, and date arithmetic used by the
calculation SHALL be evaluated in UTC.

#### Scenario: Same saldo regardless of runtime timezone

- **WHEN** the saldo is computed for the same settings and worklogs in any runtime timezone
- **THEN** the result is identical

#### Scenario: Begin date at the UTC day boundary

- **GIVEN** a begin date stored at UTC midnight and a single full expected day worked
- **WHEN** the saldo is computed in a non-UTC runtime
- **THEN** the working-day count is not shifted by the runtime timezone
- **AND** the result matches the UTC computation
