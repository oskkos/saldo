## ADDED Requirements

### Requirement: Finalizing a session twice creates one worklog

The system SHALL create a worklog from a clock session only while that session is
still open. A second finalize of the same session — from a repeated activation, a
retry, or a second device — SHALL create no further worklog and SHALL leave the
already-cleared session cleared.

This mirrors the guard clocking in already applies: the write is conditional on
the session's state rather than assuming it.

#### Scenario: Repeated finalize creates no second worklog

- **GIVEN** a session that has already been finalized and cleared
- **WHEN** the same session is finalized again
- **THEN** no additional worklog is created
- **AND** the session remains cleared

#### Scenario: Concurrent finalize creates one worklog

- **GIVEN** one open session
- **WHEN** two finalize requests for it are processed concurrently
- **THEN** exactly one worklog is created

#### Scenario: Finalizing an open session still works

- **GIVEN** an open session
- **WHEN** it is finalized
- **THEN** the worklog is created and the session is cleared

### Requirement: A declined overlap leaves the session open

The system SHALL leave a clock session open when the user declines to save a
finalize that was reported as overlapping, and SHALL create no worklog, so the
user's tracked time is not lost and can still be corrected, saved, or discarded.

A session being finalized is subject to the same work-entry overlap check as any
other work entry.

#### Scenario: Declining the overlap keeps the session

- **GIVEN** an open session whose span overlaps a stored work entry
- **WHEN** the user finalizes it and declines to save the overlapping entry
- **THEN** no worklog is created
- **AND** the user remains clocked in with the session unchanged

#### Scenario: Confirming the overlap finalizes normally

- **GIVEN** an open session whose span overlaps a stored work entry
- **WHEN** the user finalizes it and confirms saving anyway
- **THEN** the worklog is created and the session is cleared
