# saldo Specification

## Purpose

The **saldo** is the running balance between hours a user has actually worked and
the hours they were expected to work. It is the core domain concept of the
application. This capability covers how that balance is computed from a user's
worklogs and settings, how absences affect it, and how the resulting value is
formatted for display.

This spec was reverse-engineered from the existing implementation in
`src/services/index.tsx` and its tests in `src/services/__tests__/index.test.tsx`.
It documents current behavior, not a desired future state. Items that look like
defects or ambiguities are listed under "Open Questions" rather than written as
blessed requirements.

Pure calculation only — no database or session access. Inputs are a `Settings`
object and a list of `Worklog` objects; output is a formatted `SaldoForDay`.

## Requirements

### Requirement: Running balance from begin date

The system SHALL compute the saldo as the sum of counted worked minutes minus
expected minutes, seeded by the user's configured initial balance, measured from
the user's `beginDate` up to and including the current day.

#### Scenario: Worked example

- **GIVEN** a user with `beginDate` 2023-10-14 and an initial balance of 2h 30min
- **AND** the current date is 2023-10-22
- **AND** the worklogs and absences described by the other requirements below
- **WHEN** the saldo is calculated
- **THEN** the result is `-0h 45min`

### Requirement: Initial balance seeds the sum

The system SHALL start the worked-minutes total from the user's configured
initial balance (`initialBalanceHours * 60 + initialBalanceMins`) before adding
any worklog contributions.

#### Scenario: Non-zero initial balance

- **GIVEN** settings with `initialBalanceHours = 2` and `initialBalanceMins = 30`
- **WHEN** the saldo is calculated
- **THEN** 150 minutes are added to the worked total before worklogs are counted

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

### Requirement: Worked minutes count on any calendar day

The system SHALL count the actual worked minutes of a regular (non-absence)
worklog regardless of whether the day is a working day, including weekends and
public holidays.

#### Scenario: Work logged on a Sunday counts

- **GIVEN** a regular worklog on a Sunday from 10:00 to 12:00
- **WHEN** the saldo is calculated
- **THEN** 120 worked minutes are added even though Sunday accrues no expected time

### Requirement: Worked minutes net of lunch break

The system SHALL compute a regular worklog's worked minutes as the difference
between its `to` and `from` times, minus `EXPECTED_MINUTES_LUNCH_BREAK`
(30 minutes) when `subtractLunchBreak` is set, and minus nothing otherwise.

#### Scenario: Lunch break subtracted

- **GIVEN** a worklog from 07:00 to 16:15 with `subtractLunchBreak = true`
- **WHEN** its worked minutes are computed
- **THEN** the result is 525 minutes (555 minus a 30-minute lunch)

#### Scenario: Lunch break not subtracted

- **GIVEN** a worklog from 08:00 to 16:30 with `subtractLunchBreak = false`
- **WHEN** its worked minutes are computed
- **THEN** the result is 510 minutes

### Requirement: Worklogs before the begin date are excluded

The system SHALL ignore any worklog whose `from` time is earlier than the user's
`beginDate`.

#### Scenario: Entry the day before begin date

- **GIVEN** `beginDate` 2023-10-14 and a worklog on 2023-10-13
- **WHEN** the saldo is calculated
- **THEN** that worklog contributes nothing

### Requirement: Future worklogs are excluded

The system SHALL ignore any worklog whose `to` time is later than the end of the
current day.

#### Scenario: Entry dated tomorrow

- **GIVEN** the current date is 2023-10-22 and a worklog dated 2023-10-23
- **WHEN** the saldo is calculated
- **THEN** that worklog contributes nothing

### Requirement: Flex-hours absence draws down the balance

The system SHALL treat a worklog with absence reason `flex_hours` as contributing
zero worked minutes, while the day still accrues expected time if it is a working
day. The net effect is to reduce the saldo by a full expected day.

#### Scenario: Flex day on a working day

- **GIVEN** a `flex_hours` absence on a working Thursday
- **WHEN** the saldo is calculated
- **THEN** 0 worked minutes are added
- **AND** 450 expected minutes are still accrued for that day (net -450)

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

### Requirement: Hours logged on an absence day add to the balance

The system SHALL count a regular worklog's worked minutes in addition to any
absence falling on the same day, applying each rule already specified for the
two record kinds rather than treating the combination as a special case. A
non-flex absence credits exactly the day's resolved expected minutes and the day
accrues that same expectation, so the pair nets to the regular worklog's worked
minutes: work done during a holiday raises the balance by the hours worked,
without a manual correction and without altering the absence.

#### Scenario: Work during a holiday raises the balance by the hours worked

- **GIVEN** a working Friday with a resolved expectation of 450 minutes
- **AND** a `holiday` absence on that day
- **AND** a regular 3-hour worklog on that day with no lunch deduction
- **WHEN** the saldo is calculated
- **THEN** the day contributes 450 credited plus 180 worked minutes against 450 expected
- **AND** the net effect on the balance is +180 minutes

#### Scenario: Work during a flex day draws down only the unworked part

- **GIVEN** a working day with a resolved expectation of 450 minutes
- **AND** a `flex_hours` absence on that day
- **AND** a regular 3-hour worklog on that day with no lunch deduction
- **WHEN** the saldo is calculated
- **THEN** the flex absence contributes 0 worked minutes and the worklog contributes 180 against 450 expected
- **AND** the net effect on the balance is -270 minutes

#### Scenario: Work on an absence day that is not a working day

- **GIVEN** a Saturday with a resolved expectation of 0 minutes
- **AND** an absence on that day
- **AND** a regular 3-hour worklog on that day with no lunch deduction
- **WHEN** the saldo is calculated
- **THEN** the absence contributes 0 and the worklog contributes 180 against 0 expected
- **AND** the net effect on the balance is +180 minutes

### Requirement: Any absence on a non-working day is ignored

The system SHALL treat any absence (flex or non-flex) falling on a day whose
resolved expected minutes are zero as contributing zero worked minutes; such a
day also accrues no expected time, so it has no effect on the saldo.

#### Scenario: Vacation on a Saturday

- **GIVEN** a non-flex absence on a Saturday with no override
- **WHEN** the saldo is calculated
- **THEN** it contributes 0 worked minutes and 0 expected minutes

### Requirement: Saldo formatted as hours, minutes, string, and badge

The system SHALL format the saldo total minutes into a `SaldoForDay` object
exposing `hours`, `minutes`, a `toString()`, and a `toBadge()` renderer. A
non-negative saldo SHALL use floored hours/minutes and a success badge; a
negative saldo SHALL use ceiled hours/minutes and an error badge.

#### Scenario: Negative saldo formatting

- **GIVEN** a saldo total of -45 minutes
- **WHEN** it is formatted
- **THEN** `toString()` returns `-0h 45min`
- **AND** `toBadge()` renders an error-styled badge

#### Scenario: Positive saldo formatting

- **GIVEN** a positive saldo total
- **WHEN** it is formatted
- **THEN** hours and minutes are floored
- **AND** `toBadge()` renders a success-styled badge

### Requirement: Worklog sum aggregation takes a list as given

The system SHALL provide a separate aggregation that sums the raw worked minutes
(net of lunch break) of a given list of worklogs, without applying the begin-date
window, the future-entry exclusion, or any absence special-casing. Every entry in
the list counts by its own stored times. This is a display total, distinct from
the saldo balance; which entries belong in the list is the caller's decision.

#### Scenario: Sum over a mixed list

- **GIVEN** worklogs of 2h, an absence stored as 2h, and a 1.5h entry with a lunch break
- **WHEN** the worklog sum is calculated over all three
- **THEN** the result is `5h 0min` (2 + 2 + 1, treating every entry by its raw times)

### Requirement: The day total reports hours logged, not the absence

The day view's total SHALL count the day's regular worklogs only. An absence is
stored as a full-day worklog, so counting it would report work nobody did — a
day with one absence and a five-and-a-half-hour entry SHALL read as five and a
half hours, not thirteen. This is the same figure the month calendar shows for
such a day (see the `absence` capability); the calendar's border colour asks a
different question — whether the day met its expectation — and still counts the
absence.

#### Scenario: A day with an absence and real hours

- **GIVEN** a day holding a `holiday` absence stored 08:00-16:00 with the lunch break subtracted
- **AND** a regular worklog from 08:00 to 14:00 with the lunch break subtracted
- **WHEN** the day's total is shown
- **THEN** it reads `5h 30min`, counting the regular worklog alone

#### Scenario: A day with only an absence

- **GIVEN** a day holding an absence and no regular worklogs
- **WHEN** the day's total is shown
- **THEN** it reads `0h 0min`

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

## Open Questions

These are behaviors observed in the code that are ambiguous or potentially
defective. They are documented here deliberately and are NOT to be treated as
intended requirements until resolved.

- **Today's partial day.** Expected minutes count the current day in full
  (450 min) as soon as the day begins, so the saldo reads negative during the
  working day until enough hours are logged. Is mid-day saldo meant to reflect a
  full expected day, or pro-rated?
