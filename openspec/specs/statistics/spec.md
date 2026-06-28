# statistics Specification

## Purpose

Aggregate views over a user's worklogs: total and average hours, the best and
worst days, absence counts by reason, and a per-day work-minutes chart. All
figures are scoped to the same window the [saldo](../saldo/spec.md) uses — from
the user's begin date up to the end of today.

This spec was reverse-engineered from `src/app/statistics/page.tsx` and
`src/app/statistics/workMinutesPerDayChart.tsx`. It documents current behavior,
not a desired future state. Items that look like defects are listed under "Open
Questions" rather than written as blessed requirements.

## Requirements

### Requirement: Statistics require an authenticated user with settings

The system SHALL render statistics only for an authenticated user who has a
settings row; otherwise it renders nothing.

#### Scenario: No session or no settings

- **WHEN** there is no authenticated user, or the user has no settings
- **THEN** the statistics view renders nothing

### Requirement: Same window as the saldo

The system SHALL include only worklogs whose `from` is at or after the begin date
and whose `to` is at or before the end of today, matching the saldo window.

#### Scenario: Out-of-window entries excluded

- **GIVEN** worklogs before the begin date or dated in the future
- **WHEN** statistics are computed
- **THEN** those entries are excluded from every figure

### Requirement: Separate work entries from absences

The system SHALL partition in-window worklogs into work entries (no absence
reason) and absences (with a reason), and SHALL base the hours figures on work
entries only.

#### Scenario: Absences excluded from hours totals

- **GIVEN** a mix of work entries and absences in the window
- **WHEN** total and average hours are computed
- **THEN** only work entries contribute

### Requirement: Hours figures

The system SHALL report total hours logged (sum of work-entry minutes, net of
lunch breaks), average hours per logged day, and the days with the most and least
logged hours.

#### Scenario: Totals and extremes

- **GIVEN** work entries across several days
- **WHEN** statistics are computed
- **THEN** the total is the sum of all work-entry minutes
- **AND** the most/least figures identify the highest and lowest single-day totals

### Requirement: Absence counts by reason

The system SHALL count absences per reason, excluding absences that fall on
non-working days.

#### Scenario: Absence tally

- **GIVEN** absences across the window
- **WHEN** the absence tally is computed
- **THEN** each reason shows the count of its working-day occurrences

### Requirement: Per-day work-minutes chart

The system SHALL render a chart of worked minutes per day for the in-window work
entries.

#### Scenario: Chart renders

- **WHEN** there are in-window work entries
- **THEN** a per-day work-minutes chart is shown

## Open Questions

These are behaviors observed in the code that are ambiguous or potentially
defective. They are NOT to be treated as intended requirements until resolved.

- **Division by zero with no work entries.** Average hours per day divides the
  total by the number of distinct logged days. With no in-window work entries
  that denominator is zero, producing `NaN` and a "NaNh NaNmin" display. Needs an
  empty-state.
- **"Average per day" denominator is logged days, not working days.** The average
  divides by the count of distinct days that have a work entry, not by the number
  of working days in the window. So a sparse logger sees a high average. Decide
  which denominator the label "Avg hours per day" should mean.
- **Negative/garbage spans flow through.** Totals use raw worklog minutes, so an
  entry with `to` before `from` would skew every figure. This is now mitigated
  upstream — the worklog spec requires server-side validation rejecting
  non-positive and multi-day spans — so such entries can no longer be persisted
  through the actions. Pre-existing rows (if any) remain unguarded here.
- **`toISODay` buckets days in the local timezone, not UTC.** Per-day grouping
  (`workMinutesPerDay`, most/least-hours day) keys on `toISODay(worklog.from)`,
  but `toISODay` formats with plain `dayjs(date)` (local time) rather than
  `dayjs.tz` — contradicting the project's "all date math is UTC" rule. The day a
  worklog lands in therefore depends on the runtime timezone: correct on a
  UTC-deployed server, but shifted near UTC-midnight in other timezones (e.g.
  local dev), so a worklog can be counted under the wrong day. This is a shared
  `src/util/dateFormatter.ts` defect that also affects day grouping elsewhere
  (mini-calendar, worklog lists); it is cross-cutting and out of scope for the
  validation change that surfaced it. Fixing `toISODay` to use UTC would resolve
  it globally.
