## ADDED Requirements

### Requirement: At most one absence per day

The system SHALL reject an absence for a day on which the current user already
has an absence, and SHALL persist nothing when it does. The rejection SHALL
carry a human-readable message naming the conflicting day, so the user learns
which day is already taken rather than only that something failed.

Reasons do not matter: a second absence is rejected whether or not its reason
matches the existing one, because every reason claims the whole day. Day
identity is the UTC calendar day of the record's `from` instant. Regular
worklogs are unaffected — a day may hold any number of them, with or without an
absence.

The rule SHALL hold on every path that writes an absence, including creating one
and editing an existing one onto a different day.

The rule constrains new writes only. Absences already stored when the rule takes
effect are neither reported nor repaired.

#### Scenario: Second absence with the same reason is rejected

- **GIVEN** a day that already has a `holiday` absence
- **WHEN** the user submits another `holiday` absence for that day
- **THEN** the submission is rejected and nothing is written

#### Scenario: Second absence with a different reason is also rejected

- **GIVEN** a day that already has a `holiday` absence
- **WHEN** the user submits a `sick_leave` absence for that day
- **THEN** the submission is rejected and nothing is written

#### Scenario: The message names the conflicting day

- **WHEN** an absence is rejected for colliding with an existing one
- **THEN** the user is shown a message stating that an absence already exists, identifying the day it collides with

#### Scenario: Moving an absence onto a taken day is rejected

- **GIVEN** two days, each already holding one absence
- **WHEN** one of those absences is edited onto the other's day
- **THEN** the edit is rejected and neither record changes

#### Scenario: Moving a regular worklog onto an absence day is allowed

- **GIVEN** a regular worklog on one day and an absence on another
- **WHEN** the regular worklog is edited onto the absence's day
- **THEN** the edit succeeds and both records exist on that day

#### Scenario: Pre-existing duplicates are left in place

- **GIVEN** two absences stored for the same day before the rule took effect
- **WHEN** the user's worklogs and saldo are read
- **THEN** both records remain and both still contribute, and nothing reports or repairs them

### Requirement: Hours may be logged on a day that has an absence

The system SHALL allow creating a regular worklog on a day that already has an
absence, SHALL leave the absence record untouched, and SHALL confirm the save to
the user. An absence is always consumed in full: hours worked on an absence day
are additional work, not a reduction of the absence, and no partial-day absence
is created or implied. The effect on the balance is specified by the
[saldo](../saldo/spec.md) capability.

#### Scenario: Hours are saved on an absence day

- **GIVEN** a day that already has a `holiday` absence
- **WHEN** the user submits a regular worklog for that day
- **THEN** the worklog is persisted alongside the absence

#### Scenario: The absence is not altered

- **GIVEN** a day that already has an absence
- **WHEN** a regular worklog is saved for that day
- **THEN** the absence record's reason, times, and comment are unchanged, and it is not deleted

#### Scenario: The save is confirmed

- **WHEN** a regular worklog is saved on a day that has an absence
- **THEN** the user is shown a success notification

### Requirement: Day view flags an existing absence

When the day entry view is opened for a day that already has an absence, the
system SHALL tell the user that an absence is recorded for that day and that
hours logged there are still added to their saldo. The notice SHALL be absent on
a day with no absence, and SHALL stop being shown once the day's absence is
removed.

#### Scenario: Notice on an absence day

- **WHEN** the day view is opened for a day that has an absence
- **THEN** a notice explains that an absence is recorded and that logged hours still count towards the saldo

#### Scenario: No notice on an ordinary day

- **WHEN** the day view is opened for a day with no absence
- **THEN** no such notice is shown

#### Scenario: Notice clears with the absence

- **GIVEN** the day view showing the notice for a day with one absence
- **WHEN** that absence is deleted from the day's list
- **THEN** the notice stops being shown without reloading the page

## MODIFIED Requirements

### Requirement: Multi-day absence over a date range

The system SHALL let a user create an absence spanning an inclusive date range by
choosing a from-date, a to-date, a reason, and a comment, producing one absence
record per day in the range. Each record SHALL use the user's configured default
start and end times from their settings — not a fixed constant — and mark the
lunch break as subtracted.

The range SHALL be written all-or-nothing: the system SHALL check every day in
the range before writing any of it, and if any day already has an absence, the
whole submission SHALL be rejected with nothing persisted. A message SHALL name
the conflicting days; when there are many, it SHALL name the first few and count
the rest rather than listing all of them.

#### Scenario: Three-day absence

- **GIVEN** a from-date and a to-date three days apart
- **WHEN** the absence is submitted
- **THEN** three absence records are created, one per day, all with the chosen reason and comment

#### Scenario: Range normalization

- **WHEN** the chosen from-date is after the to-date
- **THEN** the UI keeps the range coherent so the from-date is not after the to-date

#### Scenario: Records use the user's configured default times

- **GIVEN** a user whose configured default times are 09:00 and 17:00
- **WHEN** they create an absence
- **THEN** each record is stored with those times rather than the application-wide defaults

#### Scenario: One taken day rejects the whole range

- **GIVEN** a five-day range in which the third day already has an absence
- **WHEN** the range is submitted
- **THEN** no records are created for any of the five days
- **AND** the message names the third day

#### Scenario: Many taken days are summarized

- **GIVEN** a range in which more days already have absences than the message lists individually
- **WHEN** the range is submitted
- **THEN** the message names the first few conflicting days and reports how many more there are

### Requirement: Reason iconography

The system SHALL display a distinct icon per absence reason in worklog listings
and in the month calendar. On a calendar day that holds both an absence and
regular worklogs, the icon SHALL NOT displace the day's logged hours: both SHALL
be shown together. The hours shown on such a day SHALL count the day's regular
worklogs only, excluding the absence's own stored times, so the figure reads as
the work done on top of the absence.

#### Scenario: Icon per reason

- **WHEN** an absence appears in a worklog list
- **THEN** an icon corresponding to its reason is shown

#### Scenario: Hours worked on an absence day stay visible

- **GIVEN** a calendar day with a `holiday` absence and a 3-hour regular worklog
- **WHEN** the month calendar is rendered
- **THEN** the day shows both the holiday icon and 3 hours
- **AND** the absence's own stored times are not included in that figure

#### Scenario: An absence-only day shows no hours

- **GIVEN** a calendar day with an absence and no regular worklogs
- **WHEN** the month calendar is rendered
- **THEN** the day shows the reason icon and no hours figure
