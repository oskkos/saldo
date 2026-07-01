## MODIFIED Requirements

### Requirement: Expected minutes accrue only on working days

The system SHALL accrue, for each day from `beginDate` through the current day
inclusive, the expected minutes resolved for that day (see the `expected-hours`
capability): a per-date override when present, otherwise 0 on non-working days
(weekends and public holidays, per `isNonWorkingDay`), otherwise the user's
configurable default. The fixed `EXPECTED_HOURS_PER_DAY` (7.5h) constant is no
longer used.

#### Scenario: Weekends and holidays do not raise the expectation

- **GIVEN** a date range that includes Saturdays, Sundays, or public holidays with no overrides
- **WHEN** expected minutes are accumulated
- **THEN** those days contribute 0 expected minutes
- **AND** each working day contributes the user's configured default

#### Scenario: A short day accrues its overridden expectation

- **GIVEN** a working day with an override of 300 minutes
- **WHEN** expected minutes are accumulated
- **THEN** that day contributes 300 expected minutes instead of the default

### Requirement: Non-flex absence on a working day is balance-neutral

The system SHALL treat a worklog whose absence reason is anything other than
`flex_hours`, falling on a day whose resolved expected minutes are greater than
zero, as contributing exactly that day's resolved expected minutes as worked
time, regardless of the worklog's stored `from`/`to` times. Because the same day
also accrues the same resolved expected minutes, such a day is balance-neutral.

#### Scenario: Vacation on a working Friday

- **GIVEN** a non-flex absence on a working Friday with stored times 08:00–16:00 and no override (default 450)
- **WHEN** the saldo is calculated
- **THEN** exactly 450 worked minutes are added (the stored times are not used)
- **AND** 450 expected minutes are accrued (net 0)

#### Scenario: Vacation on an overridden short day

- **GIVEN** a non-flex absence on a day overridden to 300 minutes
- **WHEN** the saldo is calculated
- **THEN** exactly 300 worked minutes are added and 300 expected minutes are accrued (net 0)

### Requirement: Any absence on a non-working day is ignored

The system SHALL treat any absence (flex or non-flex) falling on a day whose
resolved expected minutes are zero as contributing zero worked minutes; such a
day also accrues no expected time, so it has no effect on the saldo.

#### Scenario: Vacation on a Saturday

- **GIVEN** a non-flex absence on a Saturday with no override
- **WHEN** the saldo is calculated
- **THEN** it contributes 0 worked minutes and 0 expected minutes
