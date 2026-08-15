# data-load-performance Specification

## Purpose

This capability governs how the server-rendered app reads data efficiently on
each request, so pages load quickly and reliably even against a database that is
slow to wake. It covers per-request deduplication of shared reads, concurrency
of independent reads, fail-fast connection acquisition, and request-duration
limits that tolerate a database cold start without being killed as a timeout.

## Requirements

### Requirement: Shared reads are deduplicated per request

Repository read functions whose results are consumed by more than one server component during a single render (e.g. by both the root layout and the page) SHALL be memoized per request so the underlying database query executes at most once per request.

#### Scenario: Layout and page read the same data

- **WHEN** a single `GET` request renders both the root layout (Navbar) and a page that each call `getSettings`, `getWorklogs`, or `getExpectedHoursOverrides`
- **THEN** each of those queries executes exactly once for that request, not once per caller

#### Scenario: Distinct requests are not shared

- **WHEN** two separate requests each read the same data
- **THEN** each request performs its own read (the memoization is scoped to a single request, not shared across requests or users)

### Requirement: Independent reads execute concurrently

Independent database reads issued while rendering a page SHALL be able to execute concurrently rather than being forced to run one at a time. The connection pool SHALL permit enough concurrent connections that page-level parallelism (e.g. `Promise.all` over independent reads) is not serialized at the pool layer.

#### Scenario: Home page reads run in parallel

- **WHEN** the home page needs worklogs, settings, expected-hours overrides, and the active clock session, none of which depends on another's result
- **THEN** those reads are dispatched concurrently and their latencies overlap rather than summing

#### Scenario: Concurrency does not exhaust the database

- **WHEN** the connection pool is sized to allow concurrent reads
- **THEN** the configured maximum stays within the safe connection budget of the pooled database endpoint, so widening concurrency does not risk exhausting Postgres connections

### Requirement: Connection attempts fail fast

The database connection pool SHALL be configured with an explicit connection-acquisition timeout so that a connection attempt against an unavailable or waking database fails within a bounded time rather than hanging indefinitely.

#### Scenario: Database is slow to accept a connection

- **WHEN** the database cannot accept a new connection within the configured timeout
- **THEN** the connection attempt rejects with an error within that bounded time instead of blocking until the serverless function is killed

### Requirement: Server request duration guards against premature termination

Server-rendered routes that perform database work SHALL declare a request-duration limit high enough to absorb a database cold start, so a slow-but-successful cold load is not terminated as a timeout.

#### Scenario: Cold start on initial load

- **WHEN** the initial page load triggers a database cold start that takes several seconds
- **THEN** the request completes and renders rather than being killed by the platform's default duration limit

### Requirement: Repeated holiday lookups over a date range are cached

Computing whether days are non-working over a date range (e.g. the `beginDate → today` saldo accrual) SHALL NOT re-initialize the holiday dataset or recompute holidays per day. Public holidays SHALL be resolved through a cache keyed by year, so the cost of a range computation is bounded by the number of distinct years spanned, not the number of days.

#### Scenario: Saldo accrual over a long date range

- **WHEN** the saldo is computed over a range spanning many days across a few years
- **THEN** each year's public holidays are computed at most once and reused for every day in that year
- **AND** the per-day non-working check is a constant-time lookup, so render cost does not scale linearly with the number of days

#### Scenario: Holiday classification is unchanged

- **WHEN** any given date is checked for being a public holiday
- **THEN** the result is identical to computing it directly (only public-type holidays count), for every date the existing tests assert

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

