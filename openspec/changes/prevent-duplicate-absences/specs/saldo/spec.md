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
