## ADDED Requirements

### Requirement: Worklog entry supports a duration mode

The worklog entry form SHALL offer two mutually exclusive input modes — **Times**
(a `from`/`to` pair) and **Duration** (hours + minutes) — toggled by the user.
Regardless of mode, a worklog is stored as a `from`/`to` pair; Duration mode is an
input affordance only and introduces no new stored field.

In Duration mode:

- The duration entered SHALL be interpreted as the **net worked minutes** — the
  value that contributes to saldo (`worklogMinutes`) — not the raw `to − from`
  span. The "subtract lunch break" control SHALL be hidden, and the saved
  worklog's `subtractLunchBreak` flag SHALL be `false`.
- Hours SHALL be a non-negative integer and minutes an integer in the range
  0–59; the total duration SHALL be strictly greater than zero.
- On save the system SHALL synthesize `from` and `to` from an **anchor** start
  time: `from` = anchor, `to` = anchor + duration. The anchor SHALL be the
  worklog's existing `from` when editing an entry that already has one, and the
  user's configured default start time (`fromDefault`) otherwise.
- If `anchor + duration` does not fall on the same calendar day as the anchor,
  the entry SHALL be rejected with a duration-specific error and SHALL NOT be
  persisted.

The edit form SHALL open in Times mode for an existing worklog so that editing
unrelated fields does not rewrite the stored times. When the user switches an
existing worklog into Duration mode, the hours/minutes SHALL be prefilled from
the worklog's current net worked minutes.

#### Scenario: New entry from duration uses the default start

- **GIVEN** a user whose default start time is 08:00
- **WHEN** they create a worklog in Duration mode of 7h 30min
- **THEN** the worklog is persisted with `from` 08:00, `to` 15:30, and `subtractLunchBreak` false

#### Scenario: Editing an existing entry in duration mode keeps its start

- **GIVEN** an existing worklog from 09:15 to 16:45
- **WHEN** the user switches to Duration mode and saves 8h 0min
- **THEN** the worklog is persisted with `from` 09:15 and `to` 17:15

#### Scenario: Duration is net worked time, not span

- **GIVEN** an existing worklog from 08:00 to 16:00 with the lunch break subtracted (net 7h 30min)
- **WHEN** the user switches to Duration mode
- **THEN** the hours/minutes are prefilled to 7h 30min
- **AND** saving unchanged persists `from` 08:00, `to` 15:30, `subtractLunchBreak` false, leaving the saldo contribution unchanged at 7h 30min

#### Scenario: Duration crossing midnight is rejected

- **WHEN** a worklog is saved in Duration mode where the anchor start plus the duration falls on a later calendar day
- **THEN** the entry is rejected with a duration-specific error
- **AND** nothing is written to the database

#### Scenario: Non-positive duration is rejected

- **WHEN** a worklog is saved in Duration mode with a total duration of zero
- **THEN** the entry is rejected
- **AND** nothing is written to the database

#### Scenario: Edit opens in times mode

- **WHEN** the edit form is opened for an existing worklog
- **THEN** it starts in Times mode showing the stored `from`/`to`
- **AND** the stored times are not modified unless the user changes them
