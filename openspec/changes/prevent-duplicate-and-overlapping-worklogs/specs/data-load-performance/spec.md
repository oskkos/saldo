## ADDED Requirements

### Requirement: Per-user worklog lookups bounded by time are index-backed

The system SHALL serve worklog queries that filter to one user and bound the
result by the record's `from` instant with a database index covering those
columns, so the lookup does not scan the user's full history. This covers the
range reads that render the app and the bounded read that every worklog write now
performs to detect overlap.

#### Scenario: Overlap detection on write

- **WHEN** a worklog is created or edited and the system reads the candidate entries its span could overlap
- **THEN** that read is served by an index on the owning user and the `from` instant, not by scanning the worklog table

#### Scenario: Range read for rendering

- **WHEN** the app lists a user's worklogs for a bounded date range
- **THEN** the same index serves the query

#### Scenario: Write cost does not grow with history

- **GIVEN** a user with a long history of worklogs
- **WHEN** they create a new worklog
- **THEN** the cost of the overlap read is bounded by the entries near the submitted span rather than by the size of their history
