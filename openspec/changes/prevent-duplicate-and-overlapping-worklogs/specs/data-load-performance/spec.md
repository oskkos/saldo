## ADDED Requirements

### Requirement: Per-user worklog lookups bounded by time are index-backed

The system SHALL serve worklog queries that filter to one user and bound the
result by the record's `from` instant with a database index covering those
columns, so the lookup is served by the index rather than by scanning the
worklog table. This covers the range reads that render the app and the read that
every worklog write performs to detect overlap.

The overlap read's index range is currently open at its lower end — it is bounded
above by the submitted span but extends back over the user's stored history — so
this requirement does not yet claim that the read's cost is independent of how
much history a user has.

#### Scenario: Overlap detection on write

- **WHEN** a worklog is created or edited and the system reads the candidate entries its span could overlap
- **THEN** that read is served by an index on the owning user and the `from` instant, not by scanning the worklog table

#### Scenario: Range read for rendering

- **WHEN** the app lists a user's worklogs for a bounded date range
- **THEN** the same index serves the query
