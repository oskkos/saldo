## ADDED Requirements

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

### Requirement: The day total reports hours logged, not the absence

The day view's total SHALL count the day's regular worklogs only. An absence is
stored as a full-day worklog, so counting it would report work nobody did — a
day with one absence and a five-and-a-half-hour entry SHALL read as five and a
half hours, not thirteen. The month calendar has no room to
show this figure and marks the absence icon instead (see the `absence`
capability); its border colour asks a different question — whether the day met
its expectation — and still counts the absence.

#### Scenario: A day with an absence and real hours

- **GIVEN** a day holding a `holiday` absence stored 08:00-16:00 with the lunch break subtracted
- **AND** a regular worklog from 08:00 to 14:00 with the lunch break subtracted
- **WHEN** the day's total is shown
- **THEN** it reads `5h 30min`, counting the regular worklog alone

#### Scenario: A day with only an absence

- **GIVEN** a day holding an absence and no regular worklogs
- **WHEN** the day's total is shown
- **THEN** it reads `0h 0min`

## MODIFIED Requirements

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

## RENAMED Requirements

- FROM: `### Requirement: Worklog sum aggregation ignores absence semantics`
- TO: `### Requirement: Worklog sum aggregation takes a list as given`

