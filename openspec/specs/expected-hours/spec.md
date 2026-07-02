# expected-hours Specification

## Purpose

Defines how the **expected worked minutes** for any given date are resolved, and
how per-user, per-date overrides of that expectation are managed. This is the
single source of truth for expected minutes consumed by the
[saldo](../saldo/spec.md) calculation, absence credit, and calendar day coloring,
replacing the previously fixed `EXPECTED_HOURS_PER_DAY` constant with a
configurable default plus optional per-date overrides.

## Requirements

### Requirement: Expected minutes are resolved per date

The system SHALL determine the expected worked minutes for a given date by the
following precedence: (1) if the user has a per-date override for that date, its
minutes; otherwise (2) if the date is a non-working day (weekend or public
holiday, per `isNonWorkingDay`), zero; otherwise (3) the user's configurable
default expected minutes. This resolution SHALL be the single source of truth for
expected minutes wherever they are needed — balance accrual, absence credit, and
calendar day coloring.

#### Scenario: Default working day

- **GIVEN** a working day with no override
- **WHEN** expected minutes are resolved
- **THEN** the result equals the user's configured default (e.g. 450)

#### Scenario: Non-working day

- **GIVEN** a weekend or public holiday with no override
- **WHEN** expected minutes are resolved
- **THEN** the result is 0

#### Scenario: Override takes precedence over the weekend rule

- **GIVEN** a Saturday with an override of 300 minutes
- **WHEN** expected minutes are resolved
- **THEN** the result is 300 (the override wins over the non-working-day rule)

### Requirement: Per-date expected-hours overrides

The system SHALL let an authenticated user create, update, and delete an expected
override for a specific date, consisting of an expected value in minutes and an
optional label. Overrides SHALL be scoped to the owning user, at most one per
date per user, with minutes constrained to a non-negative integer within defined
bounds. All override reads and writes SHALL resolve the current user first and
SHALL enforce per-user ownership; a mutation targeting another user's override
SHALL be rejected. Override mutations SHALL be exposed to client components only
through server actions.

#### Scenario: Create an override

- **GIVEN** an authenticated user
- **WHEN** they set an override of 300 minutes for 2026-12-23 with an optional label
- **THEN** an override record is persisted for that user and date

#### Scenario: One override per date

- **GIVEN** an existing override for a date
- **WHEN** the user saves another value for the same date
- **THEN** the existing override is updated rather than duplicated

#### Scenario: Non-owner mutation rejected

- **GIVEN** an override owned by a different user
- **WHEN** the current user attempts to update or delete it
- **THEN** the operation is rejected and nothing changes

#### Scenario: Negative minutes rejected

- **WHEN** an override is saved with negative minutes
- **THEN** it is rejected with a validation error and nothing is persisted
