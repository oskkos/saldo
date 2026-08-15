## MODIFIED Requirements

### Requirement: Per-user worklog lookups bounded by time are index-backed

The system SHALL serve worklog queries that filter to one user and bound the
result by the record's `from` instant with a database index covering those
columns, so the lookup is served by the index rather than by scanning the
worklog table. This covers the range reads that render the app and the read that
every worklog write performs to detect overlap.

The overlap read SHALL be bounded on both sides. Its lower bound SHALL be derived
from the enforced limit on how long a stored work entry may span, so that the
range of entries examined depends on the submitted span rather than on how much
history the user has accumulated. A lower bound SHALL NOT be narrower than that
limit allows, because an entry beginning before the bound could still end inside
the submitted span.

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

#### Scenario: The bound cannot hide a conflict

- **GIVEN** a stored work entry that begins before the overlap read's lower bound
- **WHEN** the entry's span reaches into the submitted span
- **THEN** the lower bound is wide enough that the entry is still examined and reported as a conflict
