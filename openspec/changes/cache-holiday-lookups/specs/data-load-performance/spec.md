## ADDED Requirements

### Requirement: Repeated holiday lookups over a date range are cached

Computing whether days are non-working over a date range (e.g. the `beginDate → today` saldo accrual) SHALL NOT re-initialize the holiday dataset or recompute holidays per day. Public holidays SHALL be resolved through a cache keyed by year, so the cost of a range computation is bounded by the number of distinct years spanned, not the number of days.

#### Scenario: Saldo accrual over a long date range

- **WHEN** the saldo is computed over a range spanning many days across a few years
- **THEN** each year's public holidays are computed at most once and reused for every day in that year
- **AND** the per-day non-working check is a constant-time lookup, so render cost does not scale linearly with the number of days

#### Scenario: Holiday classification is unchanged

- **WHEN** any given date is checked for being a public holiday
- **THEN** the result is identical to computing it directly (only public-type holidays count), for every date the existing tests assert

## REMOVED Requirements

### Requirement: Database compute is warmed once before concurrent reads

**Reason**: A post-deploy forced-cold trace disproved this approach. The warm-up query woke the compute, but the subsequent reads still each paid a ~1s connection cost, and warm loads remained multi-second — because the dominant initial-load cost was per-day CPU in the saldo/holiday computation, not database connection warming. The warm-up added its own ~1s cold connect for no benefit (net-negative), so its implementation is being reverted.

**Migration**: None. Internal rendering behavior only; no consumer or data contract depended on it.
