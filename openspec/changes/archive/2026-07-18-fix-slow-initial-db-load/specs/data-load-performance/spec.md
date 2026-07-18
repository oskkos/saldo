## ADDED Requirements

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
