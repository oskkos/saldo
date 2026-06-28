## MODIFIED Requirements

### Requirement: Fixed set of absence reasons

The system SHALL support exactly these absence reasons: `holiday`, `flex_hours`,
`sick_leave`, and `other`. These values SHALL be the only ones offered in the
entry UI and the only ones the database accepts. The reason `holiday` denotes
annual/vacation leave (the everyday "holiday" sense), and is distinct from
public holidays, which the system handles automatically as non-working days in
the saldo calculation.

#### Scenario: Reason selection

- **WHEN** a user enters an absence
- **THEN** they choose from holiday, flex hours, sick leave, or other

#### Scenario: Holiday means annual leave

- **WHEN** a user records a `holiday` absence
- **THEN** it represents annual/vacation leave taken by the user
- **AND** it is independent of public holidays, which are already excluded from expected hours
