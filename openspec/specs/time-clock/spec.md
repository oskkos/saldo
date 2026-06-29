# time-clock Specification

## Purpose

The **time-clock** lets a user track a workday in the moment: clock in to start a
work session, clock out to turn it into a worklog of the right length — instead of
entering exact times after the fact. It covers the open-session state, how
timestamps are captured, the clock-out finalize step (save/discard), the
single-day constraint, handling of forgotten sessions, and how the clock state is
surfaced in the UI.

A session is stored as a nullable `started_at` on the user (at most one open
session per user). Clock-out reuses the existing [worklog](../worklog/spec.md)
create path, so all worklog validation and ownership rules apply. Timestamps
follow the app's wall-clock-as-UTC convention.

## Requirements

### Requirement: Clock in starts a single open session

The system SHALL let an authenticated user clock in, recording the session start
time. At most one open session SHALL exist per user; clocking in while already
clocked in SHALL not start a second session.

#### Scenario: Clock in when idle

- **WHEN** a user who is not clocked in clocks in
- **THEN** an open session is recorded with the start time
- **AND** the UI shows the clocked-in state

#### Scenario: Clock in when already clocked in

- **WHEN** a user who is already clocked in attempts to clock in again
- **THEN** no second session is started and the existing session is unchanged

### Requirement: Session timestamps reflect the user's wall-clock

The system SHALL record the clock-in and clock-out instants as the user's
wall-clock time (captured client-side and stored as a UTC instant, per the app's
wall-clock-as-UTC convention), so the resulting worklog times match what the user
sees on their clock.

#### Scenario: Logged times match the clock

- **WHEN** a user clocks in at 08:00 and clocks out at 16:00 on their clock
- **THEN** the created worklog reads 08:00–16:00 regardless of the server timezone

### Requirement: Clock out finalizes the session

The system SHALL, on clock out, present a finalize step showing the session
duration, a lunch-break toggle (defaulting to the application default), and an
optional comment, with three outcomes: save, discard, or cancel.

#### Scenario: Save creates a worklog

- **WHEN** the user saves the finalized session
- **THEN** a worklog is created spanning the session start to end with the chosen lunch-break setting and comment
- **AND** the open session is cleared

#### Scenario: Cancel keeps the session open

- **WHEN** the user cancels the finalize step
- **THEN** no worklog is created and the user remains clocked in

### Requirement: Discard a session without logging

The system SHALL allow discarding the open session from the finalize step,
clearing it without creating any worklog, after a confirmation.

#### Scenario: Discard

- **WHEN** the user discards the session and confirms
- **THEN** the open session is cleared and no worklog is created

### Requirement: Sessions may not span more than one day

The system SHALL NOT create a worklog from a session whose start and end fall on
different calendar days. When the raw session crosses midnight (or is otherwise
implausible), the finalize step SHALL open in a corrective mode with the end time
editable and constrained to the start day, requiring the user to correct it before
saving or to discard the session.

#### Scenario: Overnight session must be corrected or discarded

- **GIVEN** an open session whose current end would fall on a later day than its start
- **WHEN** the user clocks out
- **THEN** the finalize step warns and requires a same-day end time before saving
- **AND** the user may instead discard the session

### Requirement: Forgotten sessions are handled on return

The system SHALL surface a still-open session whenever the user returns, showing
the running state and elapsed time, so a forgotten clock-out is visible and can be
resolved through the finalize step (corrected, saved, or discarded). The system
SHALL NOT automatically close or alter open sessions in the background.

#### Scenario: Returning with an open session

- **WHEN** the user opens the app while a session is still open
- **THEN** the clocked-in state and elapsed time are shown
- **AND** no background process has modified or closed the session

### Requirement: Clock state is visible across the app

The system SHALL present the clock control on the home screen (a start action when
idle; the live elapsed time and a clock-out action when running) and SHALL
indicate the clocked-in state in the always-visible saldo badge area, so the
running state is discoverable from any page.

#### Scenario: Idle home screen

- **WHEN** the user is not clocked in
- **THEN** the home screen shows a start (clock-in) action

#### Scenario: Running state is globally visible

- **WHEN** the user is clocked in
- **THEN** the home screen shows live elapsed time and a clock-out action
- **AND** the saldo badge area indicates the clocked-in state
