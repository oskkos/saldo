## ADDED Requirements

### Requirement: Database compute is warmed once before concurrent reads

Before dispatching a page's concurrent database reads, the app SHALL issue a single lightweight warm-up query and await it, so that a database cold start is incurred once per request rather than once per concurrent connection. The warm-up SHALL run only when the request will perform database reads (i.e. an authenticated request).

#### Scenario: Cold start on initial load

- **WHEN** a request begins rendering against a database compute that has scaled to zero (suspended)
- **THEN** a single warm-up query wakes the compute before the page's concurrent reads are dispatched
- **AND** those reads then execute against a warm compute and overlap, rather than each paying the cold-start connection cost

#### Scenario: Warm compute adds negligible latency

- **WHEN** the database compute is already awake
- **THEN** the warm-up query completes quickly and does not meaningfully increase the request's latency

#### Scenario: No warm-up without database work

- **WHEN** a request has no authenticated session and therefore performs no database reads
- **THEN** no warm-up query is issued
