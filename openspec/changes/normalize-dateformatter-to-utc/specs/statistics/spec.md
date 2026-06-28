## ADDED Requirements

### Requirement: Per-day grouping is timezone-independent

The system SHALL group worklogs by day using the UTC date of each worklog,
independently of the runtime timezone, so that the day a worklog is attributed to
is the same in any environment. Day-based figures (work-minutes-per-day, the
most/least-hours days, and the per-day chart) SHALL be derived from this
timezone-independent grouping.

#### Scenario: Same grouping regardless of runtime timezone

- **WHEN** the statistics are computed in any server or client timezone
- **THEN** each worklog is grouped under its UTC date
- **AND** the resulting per-day figures are identical across timezones

#### Scenario: Worklog near UTC midnight

- **WHEN** a worklog's stored instant is close to UTC midnight
- **THEN** it is grouped under its UTC calendar date
- **AND** it is not shifted into an adjacent day by the runtime timezone
